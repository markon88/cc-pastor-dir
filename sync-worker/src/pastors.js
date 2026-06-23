import { XMLParser } from 'fast-xml-parser';
import { logSync } from './db.js';

const BASE_URL = 'https://www.eadventist.net/web_services/pastors';
const MASK = 'ANT8';

// Strips a trailing generational suffix only (not anywhere in the string, to
// avoid eating a legitimate middle initial like "V") and normalizes whitespace,
// commas, and case so names can be compared regardless of which field
// eAdventist happened to put the suffix in.
function normalizeName(name) {
  return String(name ?? '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '')
    .trim()
    .toLowerCase();
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-');
}

// Mirrors the existing "lastname-firstname" id convention. Falls back to
// appending the eAdventist id in the rare case two pastors share both names.
async function uniquePastorId(env, lastName, firstName, eId) {
  const base = `${slugify(lastName)}-${slugify(firstName)}`;
  const existing = await env.DB.prepare('SELECT id FROM pastors WHERE id = ?').bind(base).first();
  return existing ? `${base}-${eId}` : base;
}

export async function syncPastors(env) {
  // Unlike congregations, eAdventist's `from` param on this endpoint only signals
  // deletions (empty records) rather than a full incremental diff of changes — so we
  // always pull the current full pastor list rather than filtering by date.
  const url = new URL(BASE_URL);
  url.searchParams.set('mask', MASK);
  url.searchParams.set('format', 'xml');

  const resp = await fetch(url.toString(), {
    headers: { AUTHORIZATION: `${env.EADVENTIST_USER}:${env.EADVENTIST_PASS}` },
  });
  if (resp.status === 429) {
    const err = new Error('Pastors API rate limited (429)');
    err.rateLimited = true;
    throw err;
  }
  if (!resp.ok) throw new Error(`Pastors API ${resp.status}: ${await resp.text()}`);

  const xml = await resp.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml);

  const orgs = parsed?.pastor_list?.organization ?? [];
  const orgList = Array.isArray(orgs) ? orgs : [orgs];

  // eAdventist office ids for paid pastoral staff. 84 (Lay Pastor) and 122 (Church Leader)
  // are volunteer roles, deliberately excluded.
  const PASTOR_OFFICE_IDS = new Set(['33', '34', '36']); // Pastor, Pastor - Associate, Pastor - Youth

  // Deduplicate officers by eAdventist ID — each real pastor may serve multiple churches
  const officerMap = new Map();
  for (const org of orgList) {
    const officers = org.officer ? (Array.isArray(org.officer) ? org.officer : [org.officer]) : [];
    for (const o of officers) {
      const officeId = String(o.office?.['@_id'] ?? '');
      if (!PASTOR_OFFICE_IDS.has(officeId)) continue;

      const eId = String(o['@_id']);
      if (o.last_name === 'OPEN' || o.first_name === 'HEAD PASTOR') continue;
      if (!officerMap.has(eId)) officerMap.set(eId, o);
    }
  }

  const unmatchedPastors = [];
  const newPastors = [];
  const eIdToPastorId = new Map();
  let updated  = 0;
  let inserted = 0;

  for (const [eId, officer] of officerMap) {
    const lastName  = String(officer.last_name  ?? '').trim();
    const firstName = String(officer.first_name ?? '').trim();
    const email     = officer.email        ? String(officer.email).trim()        : null;
    const rawPhone  = officer.mobile_phone ? String(officer.mobile_phone).trim() : null;
    const phone     = rawPhone && rawPhone !== '0000000000-' ? rawPhone.replace(/-$/, '') : null;

    // Match by eadventist_id, then fall back to last + first name. The fallback
    // only ever runs once per pastor — after a match, eadventist_id is stored
    // and every future sync matches by ID alone, same as churches by org_code.
    let pastor = await env.DB.prepare(
      'SELECT id FROM pastors WHERE eadventist_id = ?'
    ).bind(eId).first();

    if (!pastor) {
      // We store generational suffixes (Jr./Sr./II/III/IV) inline in first_name,
      // but eAdventist's feed often omits them or formats them differently
      // ("Eli Rojas, Jr." vs our "Eli Jr. Rojas") — strip them from both sides
      // so the one-time bootstrap match isn't broken by formatting alone.
      const candidates = await env.DB.prepare(
        'SELECT id, first_name, last_name FROM pastors WHERE active = 1'
      ).all();
      const normFirst = normalizeName(firstName);
      const normLast  = normalizeName(lastName);
      const match = candidates.results.find(c =>
        normalizeName(c.first_name) === normFirst && normalizeName(c.last_name) === normLast
      );
      pastor = match ?? null;

      if (pastor) {
        // Store ID for future runs
        await env.DB.prepare('UPDATE pastors SET eadventist_id = ? WHERE id = ?')
          .bind(eId, pastor.id).run();
      }
    }

    let wasInserted = false;
    if (!pastor && lastName && firstName) {
      // Genuinely new hire — eAdventist is the source of truth for who's a
      // pastor, so create the directory record automatically rather than
      // requiring a human to notice and add them by hand.
      const newId = await uniquePastorId(env, lastName, firstName, eId);
      await env.DB.prepare(`
        INSERT INTO pastors (id, eadventist_id, last_name, first_name, display_name, email, primary_phone, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(newId, eId, lastName, firstName, `${firstName} ${lastName}`, email, phone).run();
      pastor = { id: newId };
      wasInserted = true;
      inserted++;
      newPastors.push({ id: newId, firstName, lastName, eId });
      await logSync(env, 'pastors', 'insert', `${firstName} ${lastName}`, {
        eId, email, phone, note: 'auto-inserted from eAdventist',
      });
    }

    if (pastor) {
      // Update email and primary_phone on the pastors table
      await env.DB.prepare(`
        UPDATE pastors SET
          email         = COALESCE(?, email),
          primary_phone = COALESCE(?, primary_phone)
        WHERE id = ?
      `).bind(email, phone, pastor.id).run();

      // Upsert the mobile entry in pastor_phones
      if (phone) {
        const existing = await env.DB.prepare(
          'SELECT id FROM pastor_phones WHERE pastor_id = ? AND mobile = 1'
        ).bind(pastor.id).first();

        if (existing) {
          await env.DB.prepare('UPDATE pastor_phones SET number = ? WHERE id = ?')
            .bind(phone, existing.id).run();
        } else {
          await env.DB.prepare(
            'INSERT INTO pastor_phones (pastor_id, number, mobile) VALUES (?, ?, 1)'
          ).bind(pastor.id, phone).run();
        }
      }
      eIdToPastorId.set(eId, pastor.id);
      if (!wasInserted) updated++;
    } else {
      unmatchedPastors.push({ eId, firstName, lastName, email, phone });
      await logSync(env, 'pastors', 'unmatched', `${firstName} ${lastName}`, {
        eId, email, phone, note: 'no matching pastor in directory',
      });
    }
  }

  // Rebuild pastor_churches from the org/officer data in this response — for every org
  // present here, replace its pastor links with whoever currently holds a pastor office,
  // so a pastor moving between churches drops the old link and gains the new one.
  let churchLinksUpdated = 0;
  for (const org of orgList) {
    const orgCode = org['@_org_code'];
    const orgId   = String(org['@_id'] ?? '');

    const church = await env.DB.prepare('SELECT org_code FROM churches WHERE org_code = ?').bind(orgCode).first();

    if (!church) {
      await logSync(env, 'pastors', 'unmatched_church', org.name ?? null, {
        orgId, orgCode, note: 'no matching church for org in pastor sync',
      });
      continue;
    }

    const officers = org.officer ? (Array.isArray(org.officer) ? org.officer : [org.officer]) : [];
    const currentPastorIds = officers
      .filter(o => PASTOR_OFFICE_IDS.has(String(o.office?.['@_id'] ?? '')))
      .map(o => eIdToPastorId.get(String(o['@_id'])))
      .filter(Boolean);

    await env.DB.prepare('DELETE FROM pastor_churches WHERE church_org_code = ?').bind(church.org_code).run();
    for (const pastorId of new Set(currentPastorIds)) {
      await env.DB.prepare(
        'INSERT INTO pastor_churches (pastor_id, church_org_code) VALUES (?, ?)'
      ).bind(pastorId, church.org_code).run();
    }
    churchLinksUpdated++;
  }

  await logSync(env, 'pastors', 'sync_complete', null, {
    processed: officerMap.size,
    updated,
    inserted,
    unmatched: unmatchedPastors.length,
    churchLinksUpdated,
  });

  return { updated, unmatchedPastors, newPastors };
}
