import { isAdmin, isDisasterAdmin } from '../../_lib/auth.js';

// Cheap poll (mirrors data-version.js) so the client can decide whether to
// show the disaster-mode nav entry at all, without pulling the full status blob.
export async function onRequestGet({ env, data }) {
  const row = await env.DB.prepare(
    'SELECT id, name, is_simulation FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();

  if (!row) {
    return new Response(JSON.stringify({ active: false }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const user = data.user;
  const canManage = isAdmin(user.email, env) || await isDisasterAdmin(user.email, env.DB, row.id);

  return new Response(JSON.stringify({ active: true, incidentId: row.id, name: row.name, isSimulation: !!row.is_simulation, canManage }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
