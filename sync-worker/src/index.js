import { syncCongregations } from './congregations.js';
import { syncPastors }       from './pastors.js';
import { notify }            from './notify.js';
import { getLastSync, setLastSync, logSync, bumpDataVersion } from './db.js';

export default {
  // Runs on cron schedule: Tue & Fri at 9:00 UTC (4 AM EST / 5 AM EDT)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSync(env, false));
  },

  // Manual HTTP trigger for testing / one-off full syncs
  // POST / with Authorization: Bearer <SYNC_SECRET>
  // Add ?full=true to ignore the FROM parameter and sync everything
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const auth = request.headers.get('Authorization') ?? '';
    if (!env.SYNC_SECRET || auth !== `Bearer ${env.SYNC_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const params = new URL(request.url).searchParams;
    const full = params.get('full') === 'true';
    await runSync(env, full);
    return new Response('Sync complete', { status: 200 });
  },
};

async function runSync(env, fullSync = false) {
  const lastSync = fullSync ? null : await getLastSync(env);

  let congregationResult = null;
  let pastorResult       = null;

  try {
    congregationResult = await syncCongregations(env, lastSync);
  } catch (err) {
    await logSync(env, 'congregations', err.rateLimited ? 'rate_limit' : 'error', null, { error: err.message });
    if (err.rateLimited) return;
  }

  try {
    pastorResult = await syncPastors(env);
  } catch (err) {
    await logSync(env, 'pastors', err.rateLimited ? 'rate_limit' : 'error', null, { error: err.message });
    if (err.rateLimited) return;
  }

  // Only advance the cursor if both syncs succeeded
  if (congregationResult && pastorResult) {
    await setLastSync(env);
  }

  // Bump the data version any sync wrote to D1, so client apps' "check for
  // updates" (which compares this value, not the actual data) knows to refetch.
  await bumpDataVersion(env);

  const newChurches      = congregationResult?.newChurches      ?? [];
  const unmatchedPastors = pastorResult?.unmatchedPastors        ?? [];
  if (newChurches.length > 0 || unmatchedPastors.length > 0) {
    await notify(env, newChurches, unmatchedPastors);
  }
}
