import { isAdmin } from '../../_lib/auth.js';

export async function onRequest({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { method } = request;
  const json = h => new Response(JSON.stringify(h), { headers: { 'Content-Type': 'application/json' } });

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT email, added_by, created_at FROM allowed_emails ORDER BY created_at DESC'
    ).all();
    return json(results);
  }

  if (method === 'POST') {
    const { email } = await request.json().catch(() => ({}));
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await env.DB.prepare('INSERT OR REPLACE INTO allowed_emails (email, added_by) VALUES (?, ?)')
      .bind(email.toLowerCase().trim(), user.email).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    const email = new URL(request.url).searchParams.get('email');
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await env.DB.prepare('DELETE FROM allowed_emails WHERE email = ?').bind(email.toLowerCase()).run();
    return json({ ok: true });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}
