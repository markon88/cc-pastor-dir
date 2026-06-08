import { isAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ data, env }) {
  if (!data.user || !isAdmin(data.user.email, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results } = await env.DB.prepare(`
    SELECT id, sync_type, action, entity_name, details, created_at
    FROM sync_log
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}
