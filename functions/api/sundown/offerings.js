import { isAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Admin editor backing store for the conference offering plan printed on
// Sundown Calendars. GET returns one year's plan plus every offering name
// ever entered (for autocomplete); POST replaces one year's plan wholesale.
export async function onRequestGet({ request, env, data }) {
  if (!data.user || !isAdmin(data.user.email, env)) return json({ error: 'Forbidden' }, 403);

  const year = parseInt(new URL(request.url).searchParams.get('year'), 10);
  if (!(year >= 2000 && year <= 2100)) return json({ error: 'Invalid year' }, 400);

  const [{ results: rows }, { results: names }] = await env.DB.batch([
    env.DB.prepare('SELECT sabbath_date, offering FROM offering_schedule WHERE sabbath_date LIKE ? ORDER BY sabbath_date').bind(`${year}-%`),
    env.DB.prepare('SELECT DISTINCT offering FROM offering_schedule ORDER BY offering'),
  ]);

  return json({
    year,
    offerings: Object.fromEntries(rows.map(r => [r.sabbath_date, r.offering])),
    knownOfferings: names.map(n => n.offering),
  });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { year, offerings } = await request.json().catch(() => ({}));
  if (!(Number.isInteger(year) && year >= 2000 && year <= 2100) || !offerings || typeof offerings !== 'object') {
    return json({ error: 'Invalid request' }, 400);
  }

  const entries = [];
  for (const [date, raw] of Object.entries(offerings)) {
    const offering = String(raw ?? '').trim();
    if (!offering) continue;
    const d = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(d) || d.getUTCFullYear() !== year || d.getUTCDay() !== 6) {
      return json({ error: `${date} is not a Sabbath in ${year}` }, 400);
    }
    entries.push([date, offering.slice(0, 80)]);
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM offering_schedule WHERE sabbath_date LIKE ?').bind(`${year}-%`),
    ...entries.map(([date, offering]) => env.DB.prepare(
      'INSERT INTO offering_schedule (sabbath_date, offering, updated_by) VALUES (?, ?, ?)'
    ).bind(date, offering, user.email)),
  ]);

  return json({ ok: true, saved: entries.length });
}
