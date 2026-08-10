import { isAdmin, isDisasterAdmin, isStandingDisasterAdmin } from '../../_lib/auth.js';

// Cheap poll (mirrors data-version.js) so the client can decide whether to
// show the disaster-mode nav entry at all, without pulling the full status blob.
export async function onRequestGet({ env, data }) {
  const user = data.user;
  const settingRow = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'disaster_module_enabled'").first();
  const moduleEnabled = settingRow?.value === '1';

  const row = await env.DB.prepare(
    'SELECT id, name, is_simulation FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();

  if (!row) {
    const canManage = isAdmin(user.email, env) || await isStandingDisasterAdmin(user.email, env.DB);
    return new Response(JSON.stringify({ active: false, moduleEnabled, canManage }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const canManage = isAdmin(user.email, env)
    || await isStandingDisasterAdmin(user.email, env.DB)
    || await isDisasterAdmin(user.email, env.DB, row.id);

  return new Response(JSON.stringify({ active: true, moduleEnabled, incidentId: row.id, name: row.name, isSimulation: !!row.is_simulation, canManage }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
