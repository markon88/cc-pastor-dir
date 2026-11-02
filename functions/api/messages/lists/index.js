import { json } from '../../../_lib/messages.js';

// GET  → all lists with contact counts, plus the built-in "All active pastors"
// POST → { name } create a new list
export async function onRequestGet({ env }) {
  const [{ results: lists }, pastors] = await env.DB.batch([
    env.DB.prepare(`
      SELECT l.id, l.name, l.created_by, l.created_at,
             (SELECT COUNT(*) FROM message_contacts c WHERE c.list_id = l.id) AS contact_count
        FROM message_lists l ORDER BY l.name COLLATE NOCASE
    `),
    env.DB.prepare("SELECT COUNT(*) AS n FROM pastors WHERE active = 1 AND email IS NOT NULL AND email != ''"),
  ]);
  return json({ pastorCount: pastors.results[0]?.n ?? 0, lists });
}

export async function onRequestPost({ request, env, data }) {
  const { name } = await request.json().catch(() => ({}));
  const clean = String(name ?? '').trim().slice(0, 100);
  if (!clean) return json({ error: 'A list name is required' }, 400);
  const row = await env.DB.prepare(
    'INSERT INTO message_lists (name, created_by) VALUES (?, ?) RETURNING id'
  ).bind(clean, data.user.email).first();
  return json({ ok: true, id: row.id });
}
