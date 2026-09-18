import { isAdmin } from '../../_lib/auth.js';

const SYNC_WORKER_URL = 'https://eadventist-sync.apptool.workers.dev';

export async function onRequestPost({ request, env, data }) {
  if (!data.user || !isAdmin(data.user.email, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'SYNC_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const full = new URL(request.url).searchParams.get('full') === 'true';
  const url = full ? `${SYNC_WORKER_URL}/?full=true` : SYNC_WORKER_URL;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SYNC_SECRET}` },
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Sync worker returned ${resp.status}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
