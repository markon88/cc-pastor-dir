import { isAdmin, isDisasterAdmin, resolveIdentityEmail } from '../../_lib/auth.js';
import { sendEmail, renderEmail } from '../../_lib/email.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function activeIncident(env) {
  return env.DB.prepare(
    'SELECT id, name, is_simulation, coordination_emails FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();
}

export async function onRequestGet({ env }) {
  const incident = await activeIncident(env);
  if (!incident) return json({ incidentId: null, pastorStatuses: [] });

  const { results } = await env.DB.prepare(`
    SELECT s.pastor_id, s.status, s.family_status, s.note,
           s.property_damage_residence, s.property_damage_church,
           s.property_damage_residence_status, s.property_damage_church_status,
           s.confirmed_by, s.updated_at, p.display_name
    FROM pastor_disaster_status s
    JOIN pastors p ON p.id = s.pastor_id
    WHERE s.incident_id = ?
    ORDER BY p.last_name, p.first_name
  `).bind(incident.id).all();

  return json({
    incidentId: incident.id,
    incidentName: incident.name,
    pastorStatuses: results.map(r => ({
      pastorId:                       r.pastor_id,
      displayName:                     r.display_name,
      status:                          r.status,
      familyStatus:                    r.family_status,
      note:                            r.note,
      propertyDamageResidence:         !!r.property_damage_residence,
      propertyDamageChurch:            !!r.property_damage_church,
      propertyDamageResidenceStatus:   r.property_damage_residence_status,
      propertyDamageChurchStatus:      r.property_damage_church_status,
      confirmedBy:                     r.confirmed_by,
      updatedAt:                       r.updated_at,
    })),
  });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);

  const body = await request.json().catch(() => ({}));
  const {
    pastorId, status, familyStatus, note,
    propertyDamageResidence, propertyDamageChurch,
    propertyDamageResidenceStatus, propertyDamageChurchStatus,
    notifyCoordination,
  } = body;
  if (!pastorId || !['ok', 'not_ok', 'unknown'].includes(status)) {
    return json({ error: 'pastorId and a valid status are required' }, 400);
  }

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const self = await env.DB.prepare('SELECT id, display_name FROM pastors WHERE id = ? AND email = ?')
    .bind(pastorId, identityEmail).first();
  const privileged = isAdmin(user.email, env) || await isDisasterAdmin(user.email, env.DB, incident.id);
  if (!self && !privileged) return json({ error: 'Forbidden' }, 403);

  const familyStatusVal = ['ok', 'not_ok', 'unknown'].includes(familyStatus) ? familyStatus : null;
  // Accept the new tri-state fields, falling back to the old plain
  // booleans (assumed "assessed") for any client still sending those.
  const damageResidenceStatus = ['yes', 'no', 'unknown'].includes(propertyDamageResidenceStatus)
    ? propertyDamageResidenceStatus
    : (propertyDamageResidence !== undefined ? (propertyDamageResidence ? 'yes' : 'no') : null);
  const damageChurchStatus = ['yes', 'no', 'unknown'].includes(propertyDamageChurchStatus)
    ? propertyDamageChurchStatus
    : (propertyDamageChurch !== undefined ? (propertyDamageChurch ? 'yes' : 'no') : null);

  await env.DB.prepare(`
    INSERT INTO pastor_disaster_status
      (incident_id, pastor_id, status, family_status, note,
       property_damage_residence, property_damage_church,
       property_damage_residence_status, property_damage_church_status,
       notify_coordination, confirmed_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(incident_id, pastor_id) DO UPDATE SET
      status = excluded.status, family_status = excluded.family_status, note = excluded.note,
      property_damage_residence = excluded.property_damage_residence,
      property_damage_church = excluded.property_damage_church,
      property_damage_residence_status = excluded.property_damage_residence_status,
      property_damage_church_status = excluded.property_damage_church_status,
      notify_coordination = excluded.notify_coordination,
      confirmed_by = excluded.confirmed_by, updated_at = datetime('now')
  `).bind(
    incident.id, pastorId, status, familyStatusVal, note ?? null,
    damageResidenceStatus === 'yes' ? 1 : 0, damageChurchStatus === 'yes' ? 1 : 0,
    damageResidenceStatus, damageChurchStatus,
    notifyCoordination ? 1 : 0, user.email
  ).run();

  const propertyDamageResidenceFlag = damageResidenceStatus === 'yes';
  const propertyDamageChurchFlag = damageChurchStatus === 'yes';

  if (notifyCoordination) {
    const to = incident.coordination_emails || env.ADMIN_EMAILS;
    const pastorRow = self ?? await env.DB.prepare('SELECT display_name FROM pastors WHERE id = ?').bind(pastorId).first();
    const damageFlag = propertyDamageResidenceFlag || propertyDamageChurchFlag;
    const subject = `${damageFlag ? '[Property Damage] ' : ''}${incident.name}: ${pastorRow?.display_name ?? pastorId} — ${status.toUpperCase()}`;
    const { html, text } = renderEmail({
      title: subject,
      heading: incident.name,
      intro: incident.is_simulation ? 'THIS IS A SIMULATION / DRILL — NOT AN ACTUAL INCIDENT' : null,
      rows: [
        { label: 'Status', value: status.toUpperCase() },
        { label: 'Reported by', value: `${user.email}${self ? '' : ' (on behalf of ' + (pastorRow?.display_name ?? pastorId) + ')'}` },
        ...(familyStatusVal === 'not_ok' ? [{ label: 'Family status', value: 'NOT OK' }] : []),
        ...(propertyDamageResidenceFlag ? [{ label: 'Property damage', value: 'Reported at residence' }] : []),
        ...(propertyDamageChurchFlag ? [{ label: 'Property damage', value: 'Reported at church' }] : []),
        ...(note ? [{ label: 'Note', value: note }] : []),
      ],
      footer: 'Sent by the CC Pastors disaster-response module.',
    });
    try {
      await sendEmail(env, { to, subject, html, text });
    } catch (err) {
      // Status is already saved; don't fail the request over a notification hiccup.
      console.error('disaster status notify failed', err);
    }
  }

  return json({ ok: true });
}
