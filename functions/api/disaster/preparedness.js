import { isAdmin, isStandingDisasterAdmin, resolveIdentityEmail } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const FIELDS = [
  'backupPower', 'backupPowerNotes',
  'emergencySupplies', 'emergencySuppliesNotes',
  'shelterAvailable', 'shelterCapacityCount', 'shelterNotes',
  'hasCommunicationPlan',
  'commMethodPhoneTree', 'commMethodGroupText', 'commMethodApp', 'commMethodOther', 'commMethodOtherDetail',
  'donationDropoff', 'donationDropoffCoordinatorName', 'donationDropoffCoordinatorPhone', 'donationDropoffCoordinatorEmail',
  'transportationAvailable', 'transportationNotes',
  'distributionPoint', 'distributionPointCoordinatorName', 'distributionPointCoordinatorPhone', 'distributionPointCoordinatorEmail',
  'emergencyContactName', 'emergencyContactPhone',
  'notes',
];
const COLUMN = {
  backupPower: 'backup_power', backupPowerNotes: 'backup_power_notes',
  emergencySupplies: 'emergency_supplies', emergencySuppliesNotes: 'emergency_supplies_notes',
  shelterAvailable: 'shelter_available', shelterCapacityCount: 'shelter_capacity_count', shelterNotes: 'shelter_notes',
  hasCommunicationPlan: 'has_communication_plan',
  commMethodPhoneTree: 'comm_method_phone_tree', commMethodGroupText: 'comm_method_group_text',
  commMethodApp: 'comm_method_app', commMethodOther: 'comm_method_other', commMethodOtherDetail: 'comm_method_other_detail',
  donationDropoff: 'donation_dropoff',
  donationDropoffCoordinatorName: 'donation_dropoff_coordinator_name',
  donationDropoffCoordinatorPhone: 'donation_dropoff_coordinator_phone',
  donationDropoffCoordinatorEmail: 'donation_dropoff_coordinator_email',
  transportationAvailable: 'transportation_available', transportationNotes: 'transportation_notes',
  distributionPoint: 'distribution_point',
  distributionPointCoordinatorName: 'distribution_point_coordinator_name',
  distributionPointCoordinatorPhone: 'distribution_point_coordinator_phone',
  distributionPointCoordinatorEmail: 'distribution_point_coordinator_email',
  emergencyContactName: 'emergency_contact_name', emergencyContactPhone: 'emergency_contact_phone',
  notes: 'notes',
};
const BOOL_FIELDS = new Set([
  'backupPower', 'emergencySupplies', 'shelterAvailable', 'hasCommunicationPlan',
  'commMethodPhoneTree', 'commMethodGroupText', 'commMethodApp', 'commMethodOther',
  'donationDropoff', 'transportationAvailable', 'distributionPoint',
]);

function toBool(v) {
  return v === null || v === undefined ? null : (v ? 1 : 0);
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

function rowToJson(r) {
  if (!r) return null;
  const out = { churchName: r.church_name, updatedBy: r.updated_by, updatedAt: r.updated_at };
  for (const f of FIELDS) {
    const col = COLUMN[f];
    out[f] = BOOL_FIELDS.has(f) ? (r[col] === null ? null : !!r[col]) : r[col];
  }
  return out;
}

// Standing (not incident-scoped) self-assessed preparedness. Collected one
// question at a time via a guided wizard on the church detail page — every
// field nullable, never required.
export async function onRequestGet({ request, env }) {
  const churchName = new URL(request.url).searchParams.get('church');
  if (!churchName) return json({ error: 'church is required' }, 400);
  const row = await env.DB.prepare('SELECT * FROM church_disaster_preparedness WHERE church_name = ?').bind(churchName).first();
  return json(rowToJson(row) ?? { churchName, ...Object.fromEntries(FIELDS.map(f => [f, null])) });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const body = await request.json().catch(() => ({}));
  const { churchName } = body;
  if (!churchName) return json({ error: 'churchName is required' }, 400);

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const serves = await pastorServesChurch(identityEmail, env.DB, churchName);
  const privileged = isAdmin(user.email, env) || await isStandingDisasterAdmin(user.email, env.DB);
  if (!serves && !privileged) return json({ error: 'Forbidden' }, 403);

  const existing = await env.DB.prepare('SELECT * FROM church_disaster_preparedness WHERE church_name = ?').bind(churchName).first() ?? {};
  const merged = {};
  for (const f of FIELDS) {
    const col = COLUMN[f];
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      merged[col] = BOOL_FIELDS.has(f) ? toBool(body[f]) : (body[f]?.toString().trim() || null);
    } else {
      merged[col] = existing[col] ?? null;
    }
  }

  const cols = Object.keys(merged);
  await env.DB.prepare(`
    INSERT INTO church_disaster_preparedness (church_name, ${cols.join(', ')}, updated_by, updated_at)
    VALUES (?, ${cols.map(() => '?').join(', ')}, ?, datetime('now'))
    ON CONFLICT(church_name) DO UPDATE SET
      ${cols.map(c => `${c} = excluded.${c}`).join(', ')},
      updated_by = excluded.updated_by, updated_at = datetime('now')
  `).bind(churchName, ...cols.map(c => merged[c]), user.email).run();

  return json({ ok: true });
}
