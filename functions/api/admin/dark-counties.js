import { isAdmin } from '../../_lib/auth.js';
import { COUNTIES_BY_STATE } from '../../_lib/counties.js';

// Admin-only report: counties (across the states this directory covers) with
// no church on record. Not surfaced in the app UI.
export async function onRequestGet({ data, env }) {
  if (!data.user || !isAdmin(data.user.email, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results } = await env.DB.prepare(
    'SELECT DISTINCT state, county FROM churches WHERE county IS NOT NULL'
  ).all();

  const covered = new Map(); // state -> Set(county)
  for (const { state, county } of results) {
    if (!covered.has(state)) covered.set(state, new Set());
    covered.get(state).add(county);
  }

  const report = {};
  for (const [state, allCounties] of Object.entries(COUNTIES_BY_STATE)) {
    const present = covered.get(state) ?? new Set();
    report[state] = allCounties.filter((county) => !present.has(county));
  }

  const missingCountyChurches = await env.DB.prepare(
    'SELECT name, org_code, street, city, state, zip FROM churches WHERE county IS NULL'
  ).all();

  return new Response(JSON.stringify({
    darkCounties: report,
    churchesMissingCounty: missingCountyChurches.results,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
