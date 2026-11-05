// Messages module — role checks, recipient building, email rendering, and
// the Resend Broadcasts send pipeline. See migrations/023_messages.sql.
//
// Why Broadcasts (not POST /emails): Resend bills Broadcasts by stored
// contacts, not per send, so these never touch the transactional quota the
// rest of the app's notifications use.
//
// Send pipeline (each step is one short request, so no Worker hits a
// subrequest/time limit no matter how big the audience is):
//   1. startSend   — create a one-off Resend segment for this message, upload
//                    every recipient as a CSV contact import into it
//                    (status → importing)
//   2. advanceSend — called by the client while polling (and by the History
//                    list for anything left mid-flight): once Resend finishes
//                    the import, create + send the broadcast (status → sent)
// A one-off segment per message means a person on several lists (a pastor
// who is also an ACS director) is a single contact and gets one copy.

import { isAdmin } from './auth.js';

export const FROM_ADDRESS = 'messages@mail.churchtoolbox.app';
// v2: the first topic was named for the conference; these messages are
// personal, not official conference communication.
const TOPIC_SETTING_KEY = 'messages_resend_topic_id_v2';
// Optional extra sentence for the footer (e.g. who builds/maintains the
// app), kept in app_settings rather than code.
const FOOTER_NOTE_KEY = 'messages_footer_note';
const RESEND = 'https://api.resend.com';
// Public page behind the follow-up button; see functions/api/confirm.js.
const CONFIRM_URL = 'https://cc-pastor-dir.churchtoolbox.app/api/confirm';
export const MAX_FOLLOWUPS = 2;
export const REMINDER_DAYS = [3, 5, 7, 14];

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// ── Roles ────────────────────────────────────────────────────────────────────
// 'sender' → manage lists, write drafts, send. 'editor' → everything but send.
export async function getMessagesRole(email, env) {
  if (!email) return null;
  if (isAdmin(email, env)) return 'sender';
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    'SELECT can_send FROM message_role_users WHERE email = ? AND revoked_at IS NULL'
  ).bind(email.toLowerCase()).first();
  if (!row) return null;
  return row.can_send ? 'sender' : 'editor';
}

// ── Recipients ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
export const isValidEmail = e => EMAIL_RE.test(String(e ?? '').trim());

export function parseAudience(raw) {
  try {
    const arr = JSON.parse(raw ?? '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(a => a === 'pastors' || Number.isInteger(a));
  } catch {
    return [];
  }
}

// Deduped by lowercased email; pastors first so their live directory data
// (name, churches) wins over a stale row on an uploaded list.
export async function buildRecipients(db, audience) {
  const out = new Map();
  const add = r => {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email) || out.has(email)) return;
    out.set(email, {
      email,
      first_name: (r.first_name ?? '').trim(),
      last_name: (r.last_name ?? '').trim(),
      organization: (r.organization ?? '').trim(),
    });
  };

  if (audience.includes('pastors')) {
    const { results } = await db.prepare(`
      SELECT p.email, p.first_name, p.last_name,
             (SELECT group_concat(c.name, ', ')
                FROM pastor_churches pc JOIN churches c ON c.org_code = pc.church_org_code
               WHERE pc.pastor_id = p.id) AS organization
        FROM pastors p
       WHERE p.active = 1 AND p.email IS NOT NULL AND p.email != ''
       ORDER BY p.last_name, p.first_name
    `).all();
    results.forEach(add);
  }

  const listIds = audience.filter(a => Number.isInteger(a));
  if (listIds.length) {
    const { results } = await db.prepare(
      `SELECT email, first_name, last_name, organization FROM message_contacts
        WHERE list_id IN (${listIds.map(() => '?').join(',')}) ORDER BY id`
    ).bind(...listIds).all();
    results.forEach(add);
  }

  return [...out.values()];
}

// Who a message goes to. A follow-up goes to the parent message's recipients
// who haven't responded, minus the sender (who may be on their own list).
// Rows include each person's token, so never return these to the browser.
export async function recipientsFor(db, campaign) {
  if (!campaign.parent_campaign_id) return buildRecipients(db, parseAudience(campaign.audience));
  const parent = await db.prepare('SELECT sent_by, reply_to FROM message_campaigns WHERE id = ?')
    .bind(campaign.parent_campaign_id).first();
  const sender = [parent?.sent_by, parent?.reply_to].map(e => String(e ?? '').trim().toLowerCase());
  const { results } = await db.prepare(`
    SELECT email, first_name, last_name, organization, token FROM message_recipients
     WHERE campaign_id = ? AND responded_at IS NULL
     ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
  `).bind(campaign.parent_campaign_id).all();
  return results.filter(r => !sender.includes(r.email)).map(r => ({
    ...r,
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    organization: r.organization ?? '',
  }));
}

// Replaces any rows from an earlier failed attempt, whose audience may differ.
async function saveRecipients(db, campaignId, recipients) {
  const insert = db.prepare(`
    INSERT INTO message_recipients (campaign_id, email, first_name, last_name, organization, token)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  await db.batch([
    db.prepare('DELETE FROM message_recipients WHERE campaign_id = ?').bind(campaignId),
    ...recipients.map(r => insert.bind(
      campaignId, r.email, r.first_name, r.last_name, r.organization,
      crypto.randomUUID().replace(/-/g, ''),
    )),
  ]);
}

// ── Rendering ────────────────────────────────────────────────────────────────
// Authors write plain text with {{first_name}} / {{last_name}} /
// {{organization}} placeholders, blank lines between paragraphs, **bold**,
// and bare URLs. We convert that to Resend's {{{VAR|fallback}}} syntax for a
// real send, or substitute a sample recipient's values for preview/test.
const MERGE_FIELDS = {
  first_name:   { resend: '{{{contact.first_name|friend}}}', key: 'first_name', fallback: 'friend' },
  last_name:    { resend: '{{{contact.last_name|}}}',   key: 'last_name',  fallback: '' },
  organization: { resend: '{{{contact.organization|}}}', key: 'organization', fallback: '' },
};
const MERGE_RE = /\{\{\s*(first_name|last_name|organization)\s*\}\}/gi;

export function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// sample = recipient object → substitute real values (escaped for html);
// sample = null → emit Resend merge tags for the broadcast.
function mergeText(text, sample, forHtml) {
  return text.replace(MERGE_RE, (_, name) => {
    const f = MERGE_FIELDS[name.toLowerCase()];
    if (!sample) return f.resend;
    const v = sample[f.key] || f.fallback;
    return forHtml ? escHtml(v) : v;
  });
}

function bodyToHtml(body, sample) {
  const paragraphs = String(body).replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  return paragraphs.map(p => {
    let h = escHtml(p);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, url => `<a href="${url}" style="color:#1a5276;">${url}</a>`);
    h = h.replace(/\n/g, '<br>');
    h = mergeText(h, sample, true);
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${h}</p>`;
  }).join('\n');
}

export function cleanFromName(name) {
  return String(name ?? '').replace(/[<>"\r\n,;]/g, '').trim().slice(0, 80);
}

export async function getFooterNote(env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(FOOTER_NOTE_KEY).first();
  return (row?.value ?? '').trim();
}

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// sample: null for the real broadcast (Resend fills merge tags + unsubscribe
// link per recipient), or a recipient object for preview / test sends.
// header: the banner text; defaults to the sender's name. These are personal
// messages from the sender, never presented as official conference mail.
export function renderMessage({ subject, body, from_name, header, parent_campaign_id }, sample = null, footerNote = '') {
  const sender = cleanFromName(from_name) || 'the sender';
  const banner = String(header ?? '').trim().slice(0, 120) || cleanFromName(from_name);
  const footerLines = [
    `Sent by ${sender} using the CC Pastor Directory app. Replies go directly to ${sender}.`,
    footerNote,
  ].filter(Boolean);
  const unsubscribeUrl = sample ? '#' : '{{{RESEND_UNSUBSCRIBE_URL}}}';
  const mergedSubject = mergeText(subject, sample, false);
  // Previews and test sends always use the 'test' link, so trying the button
  // can never record a response for a real recipient.
  const confirmUrl = parent_campaign_id
    ? `${CONFIRM_URL}?t=${sample ? 'test' : '{{{contact.confirm_token|}}}'}`
    : null;

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(mergedSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div lang="en" dir="ltr">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
${banner ? `<tr><td style="background:#1a5276;padding:14px 24px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#ffffff;">${escHtml(banner)}</td></tr>` : ''}
<tr><td style="padding:24px;font-family:${FONT_STACK};color:#1c2833;">
${bodyToHtml(body, sample)}
${confirmUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr><td style="background:#1a5276;border-radius:8px;"><a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Yes, I got this</a></td></tr></table><p style="margin:0;font-size:14px;line-height:1.5;color:#4a5568;">This opens a page with one more button. Tap that one too to finish.</p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;background:#f4f5f7;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#4a5568;">
${footerLines.map(escHtml).join(' ')}
<a href="${unsubscribeUrl}" style="color:#4a5568;">Unsubscribe from these messages</a>.
</td></tr>
</table>
</td></tr>
</table>
</div>
</body>
</html>`;

  const text = [
    mergeText(String(body).replace(/\r\n/g, '\n').trim().replace(/\*\*(.+?)\*\*/g, '$1'), sample, false),
    ...(confirmUrl ? [`Yes, I got this (opens a page with one more button; tap that one too to finish): ${confirmUrl}`] : []),
    '—',
    footerLines.join(' '),
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n\n');

  return { subject: mergedSubject, html, text };
}

// ── Resend API ───────────────────────────────────────────────────────────────
// Broadcasts create contacts, segments, and topics, so RESEND_API_KEY must
// have Full access in Resend — a sending-only key fails with a 401.
async function resend(env, path, { method = 'GET', body, form } = {}) {
  const key = env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const init = {
    method,
    headers: { 'Authorization': `Bearer ${key}` },
  };
  if (form) {
    init.body = form;
  } else if (body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  // Default Resend rate limit is 2 req/s — one gentle retry on 429.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${RESEND}${path}`, init);
    if (res.status === 429 && attempt === 0) {
      await new Promise(r => setTimeout(r, 1100));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && /restricted/i.test(data.message ?? '')) {
      throw new Error('The Resend API key is sending-only. Messages need it set to Full access in Resend.');
    }
    if (!res.ok) throw new Error(`Resend ${method} ${path} failed (${res.status}): ${data.message ?? JSON.stringify(data)}`);
    return data;
  }
}

// One shared topic for every message, so an unsubscribe only opts someone
// out of these messages — not every email the app or other projects send.
async function getTopicId(env) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(TOPIC_SETTING_KEY).first();
  if (row?.value) return row.value;
  const topicBody = {
    name: 'Pastor Directory Messages',
    description: 'Messages sent by individuals using the CC Pastor Directory app.',
    default_subscription: 'opt_in',
  };
  // visibility: 'public' lists the topic on Resend's preference page; retry
  // without it in case the REST API rejects the field.
  const topic = await resend(env, '/topics', { method: 'POST', body: { ...topicBody, visibility: 'public' } })
    .catch(() => resend(env, '/topics', { method: 'POST', body: topicBody }));
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, 'messages', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).bind(TOPIC_SETTING_KEY, topic.id).run();
  return topic.id;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function startSend(env, campaign, userEmail) {
  if (!cleanFromName(campaign.from_name)) throw new Error('Add your name in the From field before sending.');
  const isFollowUp = !!campaign.parent_campaign_id;
  const recipients = await recipientsFor(env.DB, campaign);
  if (!recipients.length) {
    throw new Error(isFollowUp
      ? 'Everyone has responded, so there’s nobody left to follow up with.'
      : 'This message has no recipients with a valid email address.');
  }

  // Claim the draft first so a double-click can't start two sends.
  const claim = await env.DB.prepare(`
    UPDATE message_campaigns SET status = 'importing', sent_by = ?, recipient_count = ?, error = NULL, updated_at = datetime('now')
     WHERE id = ? AND status IN ('draft', 'failed')
  `).bind(userEmail, recipients.length, campaign.id).run();
  if (!claim.meta.changes) throw new Error('This message is already being sent.');

  try {
    if (!isFollowUp) await saveRecipients(env.DB, campaign.id, recipients);
    await getTopicId(env); // create up front so the final step is a single call
    const segment = await resend(env, '/segments', {
      method: 'POST',
      body: { name: `Message #${campaign.id} — ${campaign.subject}`.slice(0, 100) },
    });

    const columns = ['email', 'first_name', 'last_name', 'organization'];
    const properties = { organization: { column: 'organization', type: 'string' } };
    if (isFollowUp) {
      // Rides on the Resend contact so the broadcast can merge it into each
      // person's link. Resend creates the property on first import.
      columns.push('token');
      properties.confirm_token = { column: 'token', type: 'string' };
    }
    const csv = [columns.join(',')]
      .concat(recipients.map(r => columns.map(k => csvCell(r[k])).join(',')))
      .join('\n');
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), `message-${campaign.id}.csv`);
    form.append('column_map', JSON.stringify({
      email: 'email',
      first_name: 'first_name',
      last_name: 'last_name',
      properties,
    }));
    form.append('on_conflict', 'upsert');
    form.append('segments', JSON.stringify([{ id: segment.id }]));
    const imp = await resend(env, '/contacts/imports', { method: 'POST', form });

    await env.DB.prepare(
      'UPDATE message_campaigns SET resend_segment_id = ?, resend_import_id = ? WHERE id = ?'
    ).bind(segment.id, imp.id, campaign.id).run();
  } catch (err) {
    await markFailed(env, campaign.id, err);
    throw err;
  }
}

async function markFailed(env, id, err) {
  await env.DB.prepare(
    "UPDATE message_campaigns SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(String(err?.message ?? err).slice(0, 1000), id).run();
}

// Returns the campaign's (possibly updated) status. Safe to call repeatedly
// and from several tabs — the 'sending' claim makes the broadcast one-shot.
export async function advanceSend(env, campaign) {
  if (campaign.status !== 'importing' || !campaign.resend_import_id) return campaign.status;

  let imp;
  try {
    imp = await resend(env, `/contacts/imports/${campaign.resend_import_id}`);
  } catch (err) {
    return 'importing'; // transient — try again on the next poll
  }
  if (imp.status === 'failed') {
    await markFailed(env, campaign.id, new Error('Resend could not import the recipient list.'));
    return 'failed';
  }
  if (imp.status !== 'completed') return 'importing';

  const claim = await env.DB.prepare(
    "UPDATE message_campaigns SET status = 'sending' WHERE id = ? AND status = 'importing'"
  ).bind(campaign.id).run();
  if (!claim.meta.changes) return 'sending';

  try {
    const topicId = await getTopicId(env);
    const { html, text } = renderMessage(campaign, null, await getFooterNote(env));
    const broadcast = await resend(env, '/broadcasts', {
      method: 'POST',
      body: {
        name: `Message #${campaign.id} — ${campaign.subject}`.slice(0, 100),
        segment_id: campaign.resend_segment_id,
        topic_id: topicId,
        from: `${cleanFromName(campaign.from_name)} <${FROM_ADDRESS}>`,
        ...(isValidEmail(campaign.reply_to) ? { reply_to: campaign.reply_to.trim() } : {}),
        subject: mergeText(campaign.subject, null, false),
        html,
        text,
        send: true,
      },
    });
    await env.DB.prepare(`
      UPDATE message_campaigns SET status = 'sent', resend_broadcast_id = ?, sent_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?
    `).bind(broadcast.id, campaign.id).run();
    return 'sent';
  } catch (err) {
    await markFailed(env, campaign.id, err);
    return 'failed';
  }
}
