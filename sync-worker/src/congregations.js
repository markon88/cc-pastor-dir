import { logSync, formatFromDate } from './db.js';
import { geocodeCounty } from './geocode.js';

const BASE_URL = 'https://www.eadventist.net/web_services/congregations';
const MASK = 'ANT8';

export async function syncCongregations(env, lastSync) {
  const url = new URL(BASE_URL);
  url.searchParams.set('mask', MASK);
  url.searchParams.set('format', 'json');
  if (lastSync) url.searchParams.set('from', formatFromDate(lastSync));

  const resp = await fetch(url.toString(), {
    headers: { AUTHORIZATION: `${env.EADVENTIST_USER}:${env.EADVENTIST_PASS}` },
  });
  if (resp.status === 429) {
    const err = new Error('Congregations API rate limited (429)');
    err.rateLimited = true;
    throw err;
  }
  if (!resp.ok) throw new Error(`Congregations API ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const congregations = data.congregation_list ?? [];

  const newChurches = [];
  let updated = 0;

  for (const c of congregations) {
    const orgId   = String(c.id);
    const orgCode = c.org_code;
    const name    = c.name.replace(/\s+/g, ' ').trim();
    const region  = c.region ?? null;
    const addr    = c.street_address ?? {};
    const street     = addr.address   ?? null;
    const city       = addr.city      ?? null;
    const state      = addr.state     ?? null;
    const zip        = addr.postal_code ?? null;
    const membership = c.member_count ?? null;

    // Match by org_code — stable across name changes (e.g. a group becoming a company)
    const existing = await env.DB.prepare(
      'SELECT name, street, city, state, zip, county FROM churches WHERE org_code = ?'
    ).bind(orgCode).first();

    if (existing) {
      const addressChanged = existing.street !== street || existing.city !== city
        || existing.state !== state || existing.zip !== zip;
      const county = addressChanged
        ? await geocodeCounty(street, city, state, zip)
        : existing.county;

      await env.DB.prepare(`
        UPDATE churches
        SET name = ?, org_id = ?, org_code = ?, region = ?, street = ?, city = ?, state = ?, zip = ?, membership = ?, county = ?
        WHERE org_code = ?
      `).bind(name, orgId, orgCode, region, street, city, state, zip, membership, county, orgCode).run();
      updated++;
    } else {
      const county = await geocodeCounty(street, city, state, zip);
      await env.DB.prepare(`
        INSERT INTO churches (name, org_id, org_code, region, street, city, state, zip, membership, county)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(name, orgId, orgCode, region, street, city, state, zip, membership, county).run();
      newChurches.push({ name, orgId, orgCode });
      await logSync(env, 'congregations', 'insert', name, { orgId, orgCode, note: 'auto-inserted from eAdventist' });
    }
  }

  await logSync(env, 'congregations', 'sync_complete', null, {
    processed: congregations.length,
    updated,
    inserted: newChurches.length,
    incremental: !!lastSync,
  });

  return { updated, newChurches };
}
