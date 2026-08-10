import { isAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const KEY = 'volunteers_module_enabled';

// On/off switch for the VLP/VLL tab + church-detail section, same pattern as
// functions/api/disaster/module-status.js. Unlike disaster, this one has
// been shipped and on by default — absence of a row means enabled, not off.
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(KEY).first();
  return json({ enabled: row ? row.value === '1' : true });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { enabled } = await request.json().catch(() => ({}));
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(KEY, enabled ? '1' : '0', user.email).run();

  return json({ ok: true });
}
