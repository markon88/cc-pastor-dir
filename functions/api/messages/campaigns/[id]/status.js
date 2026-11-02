import { json, advanceSend } from '../../../../_lib/messages.js';

// GET → current send status; advances importing → sent when Resend is ready.
export async function onRequestGet({ env, params }) {
  const c = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(Number(params.id)).first();
  if (!c) return json({ error: 'Not found' }, 404);
  const status = await advanceSend(env, c);
  const fresh = status === c.status ? c
    : await env.DB.prepare('SELECT status, error, recipient_count, sent_at FROM message_campaigns WHERE id = ?').bind(c.id).first();
  return json({ status: fresh.status, error: fresh.error, recipientCount: fresh.recipient_count, sentAt: fresh.sent_at });
}
