import { isAdmin } from '../_lib/auth.js';
import { sendEmail } from '../_lib/email.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const TYPES = new Set(['bug', 'feature', 'data']);
const TYPE_LABELS = { bug: 'Bug Report', feature: 'Feature Request', data: 'Data Update Request' };

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const body = await request.json().catch(() => ({}));
  const { type, message, urgent, page } = body;

  if (!TYPES.has(type)) return json({ error: 'Invalid type' }, 400);
  if (!message || !message.trim()) return json({ error: 'Message is required' }, 400);

  const result = await env.DB.prepare(`
    INSERT INTO feedback_reports (type, message, urgent, submitted_by, submitted_name, page)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(type, message.trim(), urgent ? 1 : 0, user.email, user.name ?? null, page ?? null).run();

  // Best-effort — reports are always saved to D1 (and visible in Admin) even
  // when RESEND_API_KEY isn't configured, so a notification hiccup never loses one.
  const notifyTo = env.FEEDBACK_NOTIFY_EMAIL || 'hellopastormark@gmail.com';
  const subject = `[CC Pastors] ${TYPE_LABELS[type]}${urgent ? ' (Urgent)' : ''}`;
  const text = [
    `From: ${user.name ?? user.email} <${user.email}>`,
    page ? `Page: ${page}` : null,
    '',
    message.trim(),
  ].filter(Boolean).join('\n');
  try {
    await sendEmail(env, { to: notifyTo, subject, text });
  } catch (err) {
    console.error('feedback notify failed', err);
  }

  return json({ success: true, id: result.meta.last_row_id }, 201);
}

// Admin-only — no dedicated management UI yet, just a read-only list.
export async function onRequestGet({ env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { results } = await env.DB.prepare(
    'SELECT id, type, message, urgent, submitted_by, submitted_name, page, created_at FROM feedback_reports ORDER BY created_at DESC LIMIT 200'
  ).all();

  return json({ reports: results });
}
