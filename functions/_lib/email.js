// Server-side email via Resend (https://resend.com). Requires RESEND_API_KEY
// (wrangler secret put RESEND_API_KEY) and a verified sending domain/address
// in RESEND_FROM. Used only for disaster-response coordination notifications.
export async function sendEmail(env, { to, subject, text }) {
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
      text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}
