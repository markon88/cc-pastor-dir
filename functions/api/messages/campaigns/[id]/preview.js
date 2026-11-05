import { json, recipientsFor, renderMessage, getFooterNote } from '../../../../_lib/messages.js';

// GET → rendered HTML for one sample recipient + the deduped recipient count.
// ?as=<email> previews as that recipient; defaults to the first one.
export async function onRequestGet({ request, env, params }) {
  const c = await env.DB.prepare('SELECT * FROM message_campaigns WHERE id = ?').bind(Number(params.id)).first();
  if (!c) return json({ error: 'Not found' }, 404);

  const recipients = await recipientsFor(env.DB, c);
  const as = new URL(request.url).searchParams.get('as')?.toLowerCase();
  const { token, ...sample } = recipients.find(r => r.email === as) ?? recipients[0]
    ?? { email: '', first_name: 'Sample', last_name: 'Recipient', organization: 'Sample Church' };

  const { subject, html } = renderMessage(c, sample, await getFooterNote(env));
  return json({
    subject,
    html,
    recipientCount: recipients.length,
    sample,
    // A short roster so the author can sanity-check who's included.
    recipients: recipients.map(r => ({ email: r.email, name: `${r.first_name} ${r.last_name}`.trim(), organization: r.organization })),
  });
}
