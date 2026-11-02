import { json } from '../../../_lib/messages.js';

// GET    → list + its contacts
// PATCH  → { name } rename
// DELETE → remove the list and its contacts
export async function onRequestGet({ env, params }) {
  const id = Number(params.id);
  const list = await env.DB.prepare('SELECT id, name, created_by, created_at FROM message_lists WHERE id = ?').bind(id).first();
  if (!list) return json({ error: 'Not found' }, 404);
  const { results } = await env.DB.prepare(
    'SELECT id, email, first_name, last_name, organization, added_by, added_at FROM message_contacts WHERE list_id = ? ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE, email'
  ).bind(id).all();
  return json({ ...list, contacts: results });
}

export async function onRequestPatch({ request, env, params }) {
  const { name } = await request.json().catch(() => ({}));
  const clean = String(name ?? '').trim().slice(0, 100);
  if (!clean) return json({ error: 'A list name is required' }, 400);
  await env.DB.prepare('UPDATE message_lists SET name = ? WHERE id = ?').bind(clean, Number(params.id)).run();
  return json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM message_contacts WHERE list_id = ?').bind(id),
    env.DB.prepare('DELETE FROM message_lists WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}
