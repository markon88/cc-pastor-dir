import { json, MAX_FOLLOWUPS } from '../../../../_lib/messages.js';

const TWO_TAPS = 'Please tap the button below, then tap the button on the page that opens. It takes two quick taps, and the second one is what tells me you got it.';
const DEFAULT_BODIES = [
  `{{first_name}} -\n\nI'm checking that my last message reached you. ${TWO_TAPS}`,
  `{{first_name}} -\n\nI'm trying one more time to make sure my message reached you. ${TWO_TAPS}`,
];

// POST → open this message's follow-up: an unfinished one if there is one,
// otherwise a new draft, up to MAX_FOLLOWUPS. Nothing is sent here: a
// follow-up goes out only when someone with send permission presses Send.
export async function onRequestPost({ env, params, data }) {
  const id = Number(params.id);
  const parent = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(id).first();
  if (!parent) return json({ error: 'Not found' }, 404);
  if (parent.status !== 'sent' || parent.parent_campaign_id) {
    return json({ error: 'Only a sent message can have a follow-up.' }, 400);
  }
  const tracked = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM message_recipients WHERE campaign_id = ?'
  ).bind(id).first();
  if (!tracked.n) return json({ error: 'This message was sent before recipients were recorded.' }, 400);

  const { results: existing } = await env.DB.prepare(
    'SELECT id, status FROM message_campaigns WHERE parent_campaign_id = ? ORDER BY followup_number'
  ).bind(id).all();
  const open = existing.find(f => f.status !== 'sent');
  if (open) return json({ ok: true, id: open.id });
  if (existing.length >= MAX_FOLLOWUPS) {
    return json({ error: `This message has already had ${MAX_FOLLOWUPS} follow-ups.` }, 400);
  }

  // OR IGNORE + the unique index: a double-click can't create two drafts.
  const number = existing.length + 1;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO message_campaigns
      (subject, body, from_name, header, reply_to, audience, parent_campaign_id, followup_number, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)
  `).bind(
    `Did this reach you? ${parent.subject}`.slice(0, 200), DEFAULT_BODIES[number - 1],
    parent.from_name, parent.header, parent.reply_to, id, number, data.user.email, data.user.email,
  ).run();
  const row = await env.DB.prepare(
    'SELECT id FROM message_campaigns WHERE parent_campaign_id = ? AND followup_number = ?'
  ).bind(id, number).first();
  return json({ ok: true, id: row.id });
}
