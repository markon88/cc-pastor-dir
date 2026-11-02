import { json, parseAudience, advanceSend } from '../../../_lib/messages.js';

const DEFAULTS_KEY = 'messages_last_sender';

// GET  → every message, newest first (no bodies), plus the last-used
//        From name / Reply-to so a new draft can be prefilled
// POST → create a draft
export async function onRequestGet({ env }) {
  // Nudge anything left mid-send (e.g. the sender closed the tab while the
  // contact import was still running) so History shows the true status.
  const { results: stuck } = await env.DB.prepare(
    "SELECT * FROM message_campaigns WHERE status = 'importing'"
  ).all();
  for (const c of stuck) await advanceSend(env, c);

  const [{ results }, defaults] = await env.DB.batch([
    env.DB.prepare(`
      SELECT id, subject, from_name, audience, status, recipient_count, error,
             created_by, created_at, updated_by, updated_at, sent_by, sent_at
        FROM message_campaigns ORDER BY COALESCE(sent_at, updated_at) DESC LIMIT 200
    `),
    env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(DEFAULTS_KEY),
  ]);
  let senderDefaults = {};
  try { senderDefaults = JSON.parse(defaults.results[0]?.value ?? '{}'); } catch {}
  return json({
    campaigns: results.map(c => ({ ...c, audience: parseAudience(c.audience) })),
    defaults: senderDefaults,
  });
}

export async function onRequestPost({ request, env, data }) {
  const b = await request.json().catch(() => ({}));
  const row = await env.DB.prepare(`
    INSERT INTO message_campaigns (subject, body, from_name, reply_to, audience, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
  `).bind(
    String(b.subject ?? '').slice(0, 200),
    String(b.body ?? '').slice(0, 50000),
    String(b.from_name ?? '').slice(0, 80),
    String(b.reply_to ?? '').trim().slice(0, 200),
    JSON.stringify(parseAudience(JSON.stringify(b.audience ?? []))),
    data.user.email, data.user.email,
  ).first();
  return json({ ok: true, id: row.id });
}
