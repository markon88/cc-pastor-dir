import { json, isValidEmail } from '../../../../_lib/messages.js';

// POST   → { contacts: [{ email, first_name, last_name, organization }], replace? }
//          Adds/updates by email (one row per email per list). replace: true
//          clears the list first — used for a full CSV re-upload.
// DELETE → ?contactId= remove one contact
export async function onRequestPost({ request, env, params, data }) {
  const listId = Number(params.id);
  const list = await env.DB.prepare('SELECT id FROM message_lists WHERE id = ?').bind(listId).first();
  if (!list) return json({ error: 'Not found' }, 404);

  const { contacts, replace } = await request.json().catch(() => ({}));
  if (!Array.isArray(contacts)) return json({ error: 'contacts must be an array' }, 400);
  if (contacts.length > 5000) return json({ error: 'Too many contacts in one upload (max 5,000)' }, 400);

  const cut = (v, n) => String(v ?? '').trim().slice(0, n);
  const valid = [];
  const skipped = [];
  const seen = new Set();
  for (const c of contacts) {
    const email = cut(c.email, 200).toLowerCase();
    if (!isValidEmail(email)) { skipped.push(c.email ?? ''); continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push([email, cut(c.first_name, 100), cut(c.last_name, 100), cut(c.organization, 200)]);
  }

  const stmts = [];
  if (replace) stmts.push(env.DB.prepare('DELETE FROM message_contacts WHERE list_id = ?').bind(listId));
  for (const [email, first, last, org] of valid) {
    stmts.push(env.DB.prepare(`
      INSERT INTO message_contacts (list_id, email, first_name, last_name, organization, added_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(list_id, email) DO UPDATE SET
        first_name = excluded.first_name, last_name = excluded.last_name, organization = excluded.organization
    `).bind(listId, email, first, last, org, data.user.email));
  }
  // D1 batches are transactional; chunk to keep each one modest.
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));

  return json({ ok: true, saved: valid.length, skipped });
}

// PUT → ?contactId= with { email, first_name, last_name, organization }
//       edit one person (including changing their email)
export async function onRequestPut({ request, env, params }) {
  const contactId = Number(new URL(request.url).searchParams.get('contactId'));
  if (!contactId) return json({ error: 'contactId is required' }, 400);
  const b = await request.json().catch(() => ({}));
  const cut = (v, n) => String(v ?? '').trim().slice(0, n);
  const email = cut(b.email, 200).toLowerCase();
  if (!isValidEmail(email)) return json({ error: 'That email address doesn’t look valid.' }, 400);

  const listId = Number(params.id);
  const clash = await env.DB.prepare(
    'SELECT 1 FROM message_contacts WHERE list_id = ? AND email = ? AND id != ?'
  ).bind(listId, email, contactId).first();
  if (clash) return json({ error: 'Someone else on this list already has that email address.' }, 409);

  const res = await env.DB.prepare(`
    UPDATE message_contacts SET email = ?, first_name = ?, last_name = ?, organization = ?
     WHERE id = ? AND list_id = ?
  `).bind(email, cut(b.first_name, 100), cut(b.last_name, 100), cut(b.organization, 200), contactId, listId).run();
  if (!res.meta.changes) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const contactId = Number(new URL(request.url).searchParams.get('contactId'));
  if (!contactId) return json({ error: 'contactId is required' }, 400);
  await env.DB.prepare('DELETE FROM message_contacts WHERE id = ? AND list_id = ?').bind(contactId, Number(params.id)).run();
  return json({ ok: true });
}
