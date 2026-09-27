const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Everything the client needs to draw a Sundown Calendar PDF for a given
// year: that year's offering plan, plus a lat/long for every church (sunset
// times are computed client-side in public/js/sundown.js). Fetched on demand
// rather than bundled into /api/data, so it's always current without forcing
// a directory data-version bump.
export async function onRequestGet({ request, env }) {
  const year = parseInt(new URL(request.url).searchParams.get('year'), 10);
  if (!(year >= 2000 && year <= 2100)) return json({ error: 'Invalid year' }, 400);

  const [{ results: offeringRows }, { results: churchRows }] = await env.DB.batch([
    env.DB.prepare('SELECT sabbath_date, offering FROM offering_schedule WHERE sabbath_date LIKE ? ORDER BY sabbath_date').bind(`${year}-%`),
    env.DB.prepare('SELECT name, city, state, zip, latitude, longitude FROM churches'),
  ]);

  return json({
    year,
    offerings: Object.fromEntries(offeringRows.map(r => [r.sabbath_date, r.offering])),
    churches:  churchCoordinates(churchRows),
  });
}

// ~22 churches have no lat/long from eAdventist. Sundown shifts only about a
// minute per ~12 miles, so borrowing the average position of other churches
// in the same city, ZIP, or 3-digit ZIP area is accurate enough for a
// printed calendar — flagged `approx` so the PDF can say so.
function churchCoordinates(rows) {
  const located = rows.filter(r => r.latitude != null && r.longitude != null && r.latitude !== 0);
  const avg = list => list.length
    ? { lat: list.reduce((s, r) => s + r.latitude, 0) / list.length, lng: list.reduce((s, r) => s + r.longitude, 0) / list.length }
    : null;
  const zip5 = z => (z ?? '').slice(0, 5);
  const zip3 = z => (z ?? '').slice(0, 3);

  const out = {};
  for (const r of rows) {
    if (r.latitude != null && r.longitude != null && r.latitude !== 0) {
      out[r.name] = { lat: r.latitude, lng: r.longitude };
      continue;
    }
    const fallback =
      (r.city && avg(located.filter(o => o.city?.toLowerCase() === r.city.toLowerCase() && o.state === r.state))) ||
      (zip5(r.zip).length === 5 && avg(located.filter(o => zip5(o.zip) === zip5(r.zip)))) ||
      (zip3(r.zip).length === 3 && avg(located.filter(o => zip3(o.zip) === zip3(r.zip)))) ||
      null;
    if (fallback) out[r.name] = { ...fallback, approx: true };
  }
  return out;
}
