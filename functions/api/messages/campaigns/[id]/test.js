import { json, parseAudience, buildRecipients, renderMessage, cleanFromName } from '../../../../_lib/messages.js';
import { sendEmail } from '../../../../_lib/email.js';

// POST → email a test copy to the signed-in user, filled in with the first
// recipient's details. Goes through the regular (transactional) send path —
// one email, so it doesn't matter that it isn't a broadcast.
export async function onRequestPost({ env, params, data }) {
  const c = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(Number(params.id)).first();
  if (!c) return json({ error: 'Not found' }, 404);

  const [first] = await buildRecipients(env.DB, parseAudience(c.audience));
  const sample = first ?? { first_name: 'Sample', last_name: 'Recipient', organization: 'Sample Church' };
  const { subject, html, text } = renderMessage(c, sample);

  try {
    await sendEmail({ ...env, RESEND_FROM: `${cleanFromName(c.from_name)} <messages@mail.churchtoolbox.app>` }, {
      to: data.user.email,
      subject: `[TEST] ${subject}`,
      html,
      text,
    });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
  return json({ ok: true, to: data.user.email, sampleName: `${sample.first_name} ${sample.last_name}`.trim() });
}
