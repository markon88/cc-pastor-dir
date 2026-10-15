import { logSync, formatFromDate } from './db.js';
import { geocodeCounty, geocodeCountyFromCoords } from './geocode.js';

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
  let regionSample;

  for (const c of congregations) {
    const orgId   = String(c.id);
    const orgCode = c.org_code;
    const name    = c.name.replace(/\s+/g, ' ').trim();
    // eAdventist began sending region as an object (Oct 2026), which D1 can't
    // bind — take its name/code, keeping the raw shape in the sync log.
    const region  = scalar(c.region, ['name', 'code']);
    if (regionSample === undefined && c.region != null) regionSample = c.region;
    const addr    = c.street_address ?? {};
    const street     = scalar(addr.address);
    const city       = scalar(addr.city);
    const state      = scalar(addr.state);
    const zip        = scalar(addr.postal_code);
    const membership = scalar(c.member_count);
    const mail       = c.mail_address ?? {};
    const mailStreet = scalar(mail.address);
    const mailCity   = scalar(mail.city);
    const mailState  = scalar(mail.state);
    const mailZip    = scalar(mail.postal_code);
    const website    = scalar(c.web_site);
    const phone      = scalar(c.phone);
    const email      = scalar(c.email);
    const language   = scalar(c.language);
    const latitude   = c.latitude  != null ? Number(c.latitude)  : null;
    const longitude  = c.longitude != null ? Number(c.longitude) : null;
    const isActive   = scalar(c.is_active);
    const isPublic   = scalar(c.is_public);
    const drivingDirections = scalar(c.driving_directions);
    const serviceTimes = c.service_times ? JSON.stringify(c.service_times) : null;
    const photoUrl   = c.photo_file_name
      ? `https://www.eadventist.net/organizations/${c.id}/photo?style=thumb`
      : null;

    // Match by org_code — stable across name changes (e.g. a group becoming a company)
    const existing = await env.DB.prepare(
      'SELECT name, street, city, state, zip, latitude, longitude, county FROM churches WHERE org_code = ?'
    ).bind(orgCode).first();

    // eAdventist supplies lat/long directly, so reverse-geocode from those
    // rather than looking up the address, falling back to the address lookup
    // only when coordinates are missing. Only re-geocode when location data
    // actually changed, to avoid hammering the Census API every sync.
    const locationChanged = !existing
      || existing.street !== street || existing.city !== city
      || existing.state !== state || existing.zip !== zip
      || existing.latitude !== latitude || existing.longitude !== longitude;

    const county = !locationChanged
      ? existing.county
      : latitude != null && longitude != null
        ? await geocodeCountyFromCoords(latitude, longitude)
        : await geocodeCounty(street, city, state, zip);

    if (existing) {
      await env.DB.prepare(`
        UPDATE churches
        SET name = ?, org_id = ?, org_code = ?, region = ?, street = ?, city = ?, state = ?, zip = ?,
            membership = ?, county = ?, mail_street = ?, mail_city = ?, mail_state = ?, mail_zip = ?,
            website = ?, phone = ?, email = ?, language = ?, latitude = ?, longitude = ?,
            is_active = ?, is_public = ?, driving_directions = ?, service_times = ?, photo_url = ?
        WHERE org_code = ?
      `).bind(
        name, orgId, orgCode, region, street, city, state, zip,
        membership, county, mailStreet, mailCity, mailState, mailZip,
        website, phone, email, language, latitude, longitude,
        isActive, isPublic, drivingDirections, serviceTimes, photoUrl,
        orgCode
      ).run();
      updated++;
    } else {
      await env.DB.prepare(`
        INSERT INTO churches (
          name, org_id, org_code, region, street, city, state, zip,
          membership, county, mail_street, mail_city, mail_state, mail_zip,
          website, phone, email, language, latitude, longitude,
          is_active, is_public, driving_directions, service_times, photo_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        name, orgId, orgCode, region, street, city, state, zip,
        membership, county, mailStreet, mailCity, mailState, mailZip,
        website, phone, email, language, latitude, longitude,
        isActive, isPublic, drivingDirections, serviceTimes, photoUrl
      ).run();
      newChurches.push({ name, orgId, orgCode });
      await logSync(env, 'congregations', 'insert', name, { orgId, orgCode, note: 'auto-inserted from eAdventist' });
    }
  }

  await logSync(env, 'congregations', 'sync_complete', null, {
    processed: congregations.length,
    updated,
    inserted: newChurches.length,
    incremental: !!lastSync,
    regionSample: regionSample ?? null,
  });

  return { updated, newChurches };
}

// D1 only binds scalars. If eAdventist turns a field into an object, use the
// first of `keys` it has, else its JSON, rather than failing the whole sync.
function scalar(value, keys = []) {
  if (value == null || typeof value !== 'object') return value ?? null;
  for (const k of keys) if (value[k] != null && typeof value[k] !== 'object') return value[k];
  return JSON.stringify(value);
}
