import { escHtml } from '../_lib/messages.js';

// Public page behind the "Yes, I got this" button in follow-up emails. No
// login: the token in the link identifies the recipient.
//
// Opening the link only shows a page, and the response is recorded by the
// POST from its button. Email security scanners open links automatically, so
// recording on GET would mark people who never saw the message. The wording
// here and in the email says it's two taps, so nobody thinks the first failed.
//
// Lives under /api/ because the service worker serves everything else
// cache-first, which would show a stale page to anyone with the app installed.

const TOKEN_RE = /^[a-f0-9]{32}$/;

function page(heading, message, form = '') {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escHtml(heading)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
         background: #f4f5f7; color: #1c2833; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 420px; width: 100%; background: #fff; border-radius: 12px; padding: 28px 24px; text-align: center; box-sizing: border-box; }
  h1 { margin: 0 0 10px; font-size: 22px; color: #1a5276; }
  p { margin: 0; font-size: 16px; line-height: 1.5; }
  small { display: block; margin-top: 14px; font-size: 13px; line-height: 1.5; color: #4a5568; }
  button { margin-top: 20px; width: 100%; padding: 14px; border: 0; border-radius: 8px; background: #1a5276; color: #fff; font-size: 17px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body><main><h1>${escHtml(heading)}</h1><p>${escHtml(message)}</p>${form}</main></body>
</html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

const invalid = () => page('Link not recognized', 'This link isn’t valid. You can reply to the email instead.');
const lookup = (env, token) => env.DB.prepare(`
  SELECT r.first_name, r.responded_at, c.from_name
    FROM message_recipients r JOIN message_campaigns c ON c.id = r.campaign_id
   WHERE r.token = ?
`).bind(token).first();
const thanks = from => page('All done. Thank you!', `${from || 'The sender'} can see that you got the message. You can close this page.`);

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const form = `<form method="post" action="/api/confirm"><input type="hidden" name="t" value="${escHtml(token)}"><button type="submit">Finish: I got it</button></form><small>Why a second tap? Email security systems open links on their own. This tap shows a real person saw the message.</small>`;
  if (token === 'test') return page('One more tap to finish', 'Your first tap worked. This is what recipients will see.', form);
  if (!TOKEN_RE.test(token)) return invalid();

  const r = await lookup(env, token);
  if (!r) return invalid();
  if (r.responded_at) return thanks(r.from_name);
  const name = r.first_name ? `Hi ${r.first_name}. ` : '';
  return page('One more tap to finish', `${name}Your first tap worked. Tap the button below so ${r.from_name || 'the sender'} knows this reached you.`, form);
}

export async function onRequestPost({ request, env }) {
  const token = String((await request.formData().catch(() => null))?.get('t') ?? '');
  if (token === 'test') return page('Test link', 'This came from a test email, so nothing was recorded.');
  if (!TOKEN_RE.test(token)) return invalid();

  const r = await lookup(env, token);
  if (!r) return invalid();
  await env.DB.prepare(`
    UPDATE message_recipients SET responded_at = datetime('now'), responded_via = 'button'
     WHERE token = ? AND responded_at IS NULL
  `).bind(token).run();
  return thanks(r.from_name);
}
