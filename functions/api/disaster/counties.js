import { isAdmin, resolveIdentityEmail } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function pastorServesChurch(email, db, churchName) {
  const row = await db.prepare(`
    SELECT 1 FROM pastor_churches pc
    JOIN pastors p ON p.id = pc.pastor_id
    JOIN churches c ON c.org_code = pc.church_org_code
    WHERE p.email = ? AND c.name = ?
  `).bind(email, churchName).first();
  return !!row;
}

// Standing capability data — where a church's people are willing/able to
// respond during a disaster. Not tied to any specific incident; visible and
// editable any time, independent of whether one is currently active.
export async function onRequestGet({ request, env }) {
  const churchName = new URL(request.url).searchParams.get('church');
  const { results } = churchName
    ? await env.DB.prepare('SELECT * FROM church_disaster_counties WHERE church_name = ? ORDER BY county').bind(churchName).all()
    : await env.DB.prepare('SELECT * FROM church_disaster_counties ORDER BY church_name, county').all();

  return json(results.map(r => ({
    churchName:    r.church_name,
    county:        r.county,
    mode:          r.mode,
    responseHours: r.response_hours,
    certCount:     r.cert_count,
    updatedBy:     r.updated_by,
    updatedAt:     r.updated_at,
  })));
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const body = await request.json().catch(() => ({}));
  const { churchName, county, mode, responseHours, certCount } = body;
  if (!churchName || !county || !['local', 'can_travel'].includes(mode)) {
    return json({ error: 'churchName, county and a valid mode are required' }, 400);
  }

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const serves = await pastorServesChurch(identityEmail, env.DB, churchName);
  if (!serves && !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare(`
    INSERT INTO church_disaster_counties (church_name, county, mode, response_hours, cert_count, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(church_name, county) DO UPDATE SET
      mode = excluded.mode, response_hours = excluded.response_hours,
      cert_count = excluded.cert_count, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(churchName, county, mode, responseHours ?? null, Number.isFinite(certCount) ? certCount : 0, user.email).run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, data }) {
  const user = data.user;
  const { searchParams } = new URL(request.url);
  const churchName = searchParams.get('church');
  const county = searchParams.get('county');
  if (!churchName || !county) return json({ error: 'church and county are required' }, 400);

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const serves = await pastorServesChurch(identityEmail, env.DB, churchName);
  if (!serves && !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare('DELETE FROM church_disaster_counties WHERE church_name = ? AND county = ?')
    .bind(churchName, county).run();
  return json({ ok: true });
}
