import { isAdmin, isStandingDisasterAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Standing conference-wide contacts — who pastors/churches reach out to
// directly during a disaster. Admin-editable, not hardcoded. Keyed by role
// so multiple standing contacts (overall coordination, transportation, ...)
// can live side by side in app_settings.
const ROLES = new Set(['main', 'transportation']);
const keyFor = role => `disaster_coordinator${role === 'main' ? '' : `_${role}`}`;

export async function onRequestGet({ request, env }) {
  const role = new URL(request.url).searchParams.get('role') || 'main';
  if (!ROLES.has(role)) return json({ error: 'Unknown role' }, 400);
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(keyFor(role)).first();
  const parsed = row?.value ? JSON.parse(row.value) : {};
  return json({ name: parsed.name ?? null, email: parsed.email ?? null, phone: parsed.phone ?? null });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const allowed = user && (isAdmin(user.email, env) || await isStandingDisasterAdmin(user.email, env.DB));
  if (!allowed) return json({ error: 'Forbidden' }, 403);

  const { role: rawRole, name, email, phone } = await request.json().catch(() => ({}));
  const role = rawRole || 'main';
  if (!ROLES.has(role)) return json({ error: 'Unknown role' }, 400);

  const value = JSON.stringify({ name: name?.trim() || null, email: email?.trim() || null, phone: phone?.trim() || null });
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(keyFor(role), value, user.email).run();

  return json({ ok: true });
}
