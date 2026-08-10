import { isAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const KEY = 'disaster_module_enabled';

// Master on/off switch for the whole disaster module (see also
// functions/api/volunteers/module-status.js for the same pattern).
// Asymmetric: while off, admins and standing disaster admins can still see
// and use everything (to configure/test before go-live) — everyone else
// sees nothing, regardless of whether an incident is active.
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(KEY).first();
  return json({ enabled: row?.value === '1' });
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
