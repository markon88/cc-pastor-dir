import { isAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ data, env }) {
  if (!data.user || !isAdmin(data.user.email, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results } = await env.DB.prepare(`
    SELECT email, name, picture, first_login, last_login, last_seen,
           login_count, open_count, app_version, platform
    FROM user_activity
    ORDER BY last_seen DESC
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}
