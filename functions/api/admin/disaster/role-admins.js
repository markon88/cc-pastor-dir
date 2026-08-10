import { isAdmin } from '../../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Grant/revoke the standing (permanent, cross-incident) disaster-admin role.
// Only true ADMIN_EMAILS admins may grant this — a disaster admin cannot
// chain-grant the standing role to someone else.
export async function onRequest({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { method } = request;

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT email, granted_by, granted_at, revoked_at FROM disaster_role_admins WHERE revoked_at IS NULL ORDER BY granted_at DESC'
    ).all();
    return json(results);
  }

  if (method === 'POST') {
    const { email } = await request.json().catch(() => ({}));
    if (!email?.includes('@')) return json({ error: 'A valid email is required' }, 400);
    await env.DB.prepare(`
      INSERT INTO disaster_role_admins (email, granted_by)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET granted_by = excluded.granted_by, granted_at = datetime('now'), revoked_at = NULL
    `).bind(email.toLowerCase().trim(), user.email).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    const email = new URL(request.url).searchParams.get('email');
    if (!email) return json({ error: 'email is required' }, 400);
    await env.DB.prepare(
      "UPDATE disaster_role_admins SET revoked_at = datetime('now') WHERE email = ?"
    ).bind(email.toLowerCase()).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
