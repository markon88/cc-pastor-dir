import { json, parseAudience, MAX_FOLLOWUPS, REMINDER_DAYS } from '../../../_lib/messages.js';

const EDITABLE = ['draft', 'failed'];

export async function onRequestGet({ env, params }) {
  const c = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(Number(params.id)).first();
  if (!c) return json({ error: 'Not found' }, 404);
  const { results: followups } = await env.DB.prepare(
    'SELECT id, status FROM message_campaigns WHERE parent_campaign_id = ? ORDER BY followup_number'
  ).bind(c.id).all();
  return json({ ...c, audience: parseAudience(c.audience), followups, maxFollowUps: MAX_FOLLOWUPS });
}

// PUT → save a draft (only while it's still a draft or a failed send)
export async function onRequestPut({ request, env, params, data }) {
  const b = await request.json().catch(() => ({}));
  const res = await env.DB.prepare(`
    UPDATE message_campaigns
       SET subject = ?, body = ?, from_name = ?, header = ?, reply_to = ?, audience = ?, remind_after_days = ?,
           updated_by = ?, updated_at = datetime('now')
     WHERE id = ? AND status IN (${EDITABLE.map(() => '?').join(',')})
  `).bind(
    String(b.subject ?? '').slice(0, 200),
    String(b.body ?? '').slice(0, 50000),
    String(b.from_name ?? '').slice(0, 80),
    String(b.header ?? '').slice(0, 120),
    String(b.reply_to ?? '').trim().slice(0, 200),
    JSON.stringify(parseAudience(JSON.stringify(b.audience ?? []))),
    REMINDER_DAYS.includes(Number(b.remind_after_days)) ? Number(b.remind_after_days) : 0,
    data.user.email, Number(params.id), ...EDITABLE,
  ).run();
  if (!res.meta.changes) return json({ error: 'This message has already been sent and can no longer be edited.' }, 409);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  const res = await env.DB.prepare(
    `DELETE FROM message_campaigns WHERE id = ? AND status IN (${EDITABLE.map(() => '?').join(',')})`
  ).bind(Number(params.id), ...EDITABLE).run();
  if (!res.meta.changes) return json({ error: 'Sent messages can’t be deleted.' }, 409);
  return json({ ok: true });
}
