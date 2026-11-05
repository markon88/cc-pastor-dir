import { json } from '../../../../_lib/messages.js';

// GET → who this message went to and who has responded. Tokens stay
// server-side: anyone holding one could record a response for that person.
export async function onRequestGet({ env, params }) {
  const { results } = await env.DB.prepare(`
    SELECT email, first_name, last_name, organization, responded_at, responded_via
      FROM message_recipients WHERE campaign_id = ?
     ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE, email
  `).bind(Number(params.id)).all();
  return json({ recipients: results });
}

// PUT { email, responded } → tick someone off by hand, or undo it.
export async function onRequestPut({ request, env, params, data }) {
  const b = await request.json().catch(() => ({}));
  const email = String(b.email ?? '').trim().toLowerCase();
  const stmt = b.responded
    ? env.DB.prepare(`
        UPDATE message_recipients SET responded_at = datetime('now'), responded_via = 'manual', marked_by = ?
         WHERE campaign_id = ? AND email = ? AND responded_at IS NULL
      `).bind(data.user.email, Number(params.id), email)
    : env.DB.prepare(`
        UPDATE message_recipients SET responded_at = NULL, responded_via = NULL, marked_by = NULL
         WHERE campaign_id = ? AND email = ?
      `).bind(Number(params.id), email);
  await stmt.run();
  return json({ ok: true });
}
