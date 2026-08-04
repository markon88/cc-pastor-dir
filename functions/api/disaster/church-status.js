import { isAdmin, isDisasterAdmin, resolveIdentityEmail } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const POD_SUPPLIES = ['water', 'toiletPaper', 'paperTowels', 'food', 'cleaningSupplies', 'floodBuckets'];
const POD_COLUMNS = {
  water: 'pod_water', toiletPaper: 'pod_toilet_paper', paperTowels: 'pod_paper_towels',
  food: 'pod_food', cleaningSupplies: 'pod_cleaning_supplies', floodBuckets: 'pod_flood_buckets',
};

async function activeIncident(env) {
  return env.DB.prepare(
    'SELECT id, name FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();
}

async function pastorServesChurch(email, db, churchName) {
  const row = await db.prepare(`
    SELECT 1 FROM pastor_churches pc
    JOIN pastors p ON p.id = pc.pastor_id
    JOIN churches c ON c.org_code = pc.church_org_code
    WHERE p.email = ? AND c.name = ?
  `).bind(email, churchName).first();
  return !!row;
}

export async function onRequestGet({ env }) {
  const incident = await activeIncident(env);
  if (!incident) return json({ incidentId: null, churchStatuses: [] });

  const { results } = await env.DB.prepare(
    'SELECT * FROM church_disaster_status WHERE incident_id = ? ORDER BY church_name'
  ).bind(incident.id).all();

  return json({
    incidentId: incident.id,
    incidentName: incident.name,
    churchStatuses: results.map(r => ({
      churchName:        r.church_name,
      status:            r.status,
      isPod:             !!r.is_pod,
      podSupplies:       POD_SUPPLIES.filter(k => r[POD_COLUMNS[k]]),
      isDonationDropoff: !!r.is_donation_dropoff,
      isTransportation:  !!r.is_transportation,
      notes:             r.notes,
      updatedBy:         r.updated_by,
      updatedAt:         r.updated_at,
    })),
  });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);

  const body = await request.json().catch(() => ({}));
  const { churchName, status, isPod, podSupplies, isDonationDropoff, isTransportation, notes } = body;
  if (!churchName || !['ok', 'affected', 'unknown'].includes(status)) {
    return json({ error: 'churchName and a valid status are required' }, 400);
  }

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const serves = await pastorServesChurch(identityEmail, env.DB, churchName);
  const privileged = isAdmin(user.email, env) || await isDisasterAdmin(user.email, env.DB, incident.id);
  if (!serves && !privileged) return json({ error: 'Forbidden' }, 403);

  const supplySet = new Set(Array.isArray(podSupplies) ? podSupplies : []);
  const supplyValues = POD_SUPPLIES.map(k => supplySet.has(k) ? 1 : 0);

  await env.DB.prepare(`
    INSERT INTO church_disaster_status
      (incident_id, church_name, status, is_pod, pod_water, pod_toilet_paper, pod_paper_towels,
       pod_food, pod_cleaning_supplies, pod_flood_buckets, is_donation_dropoff, is_transportation,
       notes, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(incident_id, church_name) DO UPDATE SET
      status = excluded.status, is_pod = excluded.is_pod,
      pod_water = excluded.pod_water, pod_toilet_paper = excluded.pod_toilet_paper,
      pod_paper_towels = excluded.pod_paper_towels, pod_food = excluded.pod_food,
      pod_cleaning_supplies = excluded.pod_cleaning_supplies, pod_flood_buckets = excluded.pod_flood_buckets,
      is_donation_dropoff = excluded.is_donation_dropoff, is_transportation = excluded.is_transportation,
      notes = excluded.notes, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(
    incident.id, churchName, status, isPod ? 1 : 0, ...supplyValues,
    isDonationDropoff ? 1 : 0, isTransportation ? 1 : 0, notes ?? null, user.email
  ).run();

  return json({ ok: true });
}
