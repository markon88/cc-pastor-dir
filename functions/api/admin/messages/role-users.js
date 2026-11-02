import { isAdmin } from '../../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Grant/revoke the Messages role. Admin-only (ADMIN_EMAILS), same as the
// standing disaster role — a Messages user can't grant it to others.
//   GET    → active role users
//   POST   → { email, can_send } grant or update
//   DELETE → ?email= revoke
// Non-@carolinasda.org people also need an Email Access entry to sign in.
export async function onRequest({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT email, can_send, granted_by, granted_at FROM message_role_users WHERE revoked_at IS NULL ORDER BY granted_at DESC'
    ).all();
    return json(results);
  }

  if (request.method === 'POST') {
    const { email, can_send } = await request.json().catch(() => ({}));
    if (!email?.includes('@')) return json({ error: 'A valid email is required' }, 400);
    await env.DB.prepare(`
      INSERT INTO message_role_users (email, can_send, granted_by)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET can_send = excluded.can_send, granted_by = excluded.granted_by,
        granted_at = CASE WHEN message_role_users.revoked_at IS NULL THEN message_role_users.granted_at ELSE datetime('now') END,
        revoked_at = NULL
    `).bind(email.toLowerCase().trim(), can_send ? 1 : 0, user.email).run();
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const email = new URL(request.url).searchParams.get('email');
    if (!email) return json({ error: 'email is required' }, 400);
    await env.DB.prepare(
      "UPDATE message_role_users SET revoked_at = datetime('now') WHERE email = ?"
    ).bind(email.toLowerCase()).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
