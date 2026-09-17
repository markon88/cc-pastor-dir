// Server-side email via Resend (https://resend.com). Requires RESEND_API_KEY
// (wrangler secret put RESEND_API_KEY) and a verified sending domain/address
// in RESEND_FROM. Used for disaster-response coordination notifications and
// "Report an Issue" alerts — see renderEmail() below for the shared template.
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
  const recipients = Array.isArray(to) ? to : String(to).split(',').map(e => e.trim()).filter(Boolean);
  if (!recipients.length) return;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Pastor Directory <disaster@carolinasda.org>',
      to: recipients,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BRAND = '#1a5276';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Builds a branded HTML + plain-text pair for a short, fact-driven
// notification email (disaster-response alerts, feedback reports — never
// marketing). Follows the Resend email-best-practices skill's accessibility
// checklist: lang/dir duplicated on <html> and body's direct child, layout
// tables marked role="presentation", a single <h1>, 16px+ body text, and a
// plain-text alternative sent alongside the HTML.
//
//   title      - <title> text (use the email subject; must be specific)
//   heading    - the one <h1>
//   intro      - optional lead paragraph/callout, e.g. a simulation warning
//   rows       - optional [{ label, value }] of short facts (Status: OK, etc.)
//   paragraphs - optional [string] of free-form body text (already trimmed)
//   footer     - optional small-print line at the bottom
export function renderEmail({ title, heading, intro, rows = [], paragraphs = [], footer }) {
  const introHtml = intro
    ? `<p style="margin:0 0 16px;font-weight:600;color:${BRAND};">${escHtml(intro)}</p>`
    : '';
  const rowsHtml = rows.length
    ? rows.map(r => `<p style="margin:0 0 10px;font-size:16px;line-height:1.5;"><strong>${escHtml(r.label)}:</strong> ${escHtml(r.value)}</p>`).join('')
    : '';
  const paragraphsHtml = paragraphs
    .map(p => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;white-space:pre-wrap;">${escHtml(p)}</p>`)
    .join('');
  const footerHtml = footer
    ? `<tr><td style="padding:16px 24px;background:#f4f5f7;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#4a5568;">${escHtml(footer)}</td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div lang="en" dir="ltr">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${BRAND};padding:20px 24px;">
<h1 style="margin:0;font-family:${FONT_STACK};font-size:20px;line-height:1.3;font-weight:700;color:#ffffff;">${escHtml(heading)}</h1>
</td></tr>
<tr><td style="padding:24px;font-family:${FONT_STACK};color:#1c2833;">
${introHtml}${rowsHtml}${paragraphsHtml}
</td></tr>
${footerHtml}
</table>
</td></tr>
</table>
</div>
</body>
</html>`;

  const text = [
    heading,
    intro || null,
    rows.length ? rows.map(r => `${r.label}: ${r.value}`).join('\n') : null,
    paragraphs.length ? paragraphs.join('\n\n') : null,
    footer || null,
  ].filter(Boolean).join('\n\n');

  return { html, text };
}
