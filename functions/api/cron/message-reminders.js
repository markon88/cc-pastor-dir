import { recipientsFor } from '../../_lib/messages.js';
import { sendEmail, renderEmail } from '../../_lib/email.js';

const APP_URL = 'https://cc-pastor-dir.churchtoolbox.app/';

// POST → called daily by the sync worker. Emails each sender whose "Remind me
// to follow up" date has arrived. It only tells the sender; follow-ups
// themselves are never sent from here.
export async function onRequestPost({ request, env }) {
  if (!env.CRON_SECRET || request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { results: due } = await env.DB.prepare(`
    SELECT * FROM message_campaigns
     WHERE status = 'sent' AND remind_after_days > 0 AND reminded_at IS NULL
       AND date(sent_at, '+' || remind_after_days || ' days') <= date('now')
  `).all();

  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const c of due) {
    const claim = await env.DB.prepare(
      "UPDATE message_campaigns SET reminded_at = datetime('now') WHERE id = ? AND reminded_at IS NULL"
    ).bind(c.id).run();
    if (!claim.meta.changes) continue;

    const rootId = c.parent_campaign_id ?? c.id;
    const outstanding = await recipientsFor(env.DB, { parent_campaign_id: rootId });
    const laterFollowUp = await env.DB.prepare(
      "SELECT 1 FROM message_campaigns WHERE parent_campaign_id = ? AND status = 'sent' AND sent_at > ? LIMIT 1"
    ).bind(rootId, c.sent_at).first();
    if (!outstanding.length || laterFollowUp) {
      counts.skipped++;
      continue;
    }

    const { total } = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM message_recipients WHERE campaign_id = ?'
    ).bind(rootId).first();
    const subject = `Reminder: follow up on "${c.subject.replace(/\{\{.*?\}\}/g, '').trim()}"`;
    const { html, text } = renderEmail({
      title: subject,
      heading: 'Time to follow up?',
      rows: [
        { label: 'Message', value: c.subject },
        { label: 'Still waiting on', value: `${outstanding.length} of ${total}` },
      ],
      paragraphs: [
        'Open the message in the Messages tab, tick off anyone who replied to you directly, and send a follow-up if you’d like. Nothing goes out unless you send it.',
        APP_URL,
      ],
      footer: 'You asked for this reminder when you sent the message.',
    });

    try {
      await sendEmail(env, { to: c.sent_by, subject, html, text });
      counts.sent++;
    } catch (err) {
      console.error(`Reminder for message ${c.id} failed:`, err);
      // Release the claim so tomorrow's run tries again.
      await env.DB.prepare('UPDATE message_campaigns SET reminded_at = NULL WHERE id = ?').bind(c.id).run();
      counts.failed++;
    }
  }
  return new Response(JSON.stringify(counts), { headers: { 'Content-Type': 'application/json' } });
}
