import { isAdmin, isDisasterAdmin, resolveIdentityEmail } from '../../_lib/auth.js';
import { sendEmail } from '../../_lib/email.js';

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
    SELECT s.pastor_id, s.status, s.note, s.property_damage_residence, s.property_damage_church,
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
      pastorId:                r.pastor_id,
      displayName:              r.display_name,
      status:                   r.status,
      note:                     r.note,
      propertyDamageResidence:  !!r.property_damage_residence,
      propertyDamageChurch:     !!r.property_damage_church,
      confirmedBy:              r.confirmed_by,
      updatedAt:                r.updated_at,
    })),
  });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);

  const body = await request.json().catch(() => ({}));
  const { pastorId, status, note, propertyDamageResidence, propertyDamageChurch, notifyCoordination } = body;
  if (!pastorId || !['ok', 'unknown'].includes(status)) {
    return json({ error: 'pastorId and a valid status are required' }, 400);
  }

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const self = await env.DB.prepare('SELECT id, display_name FROM pastors WHERE id = ? AND email = ?')
    .bind(pastorId, identityEmail).first();
  const privileged = isAdmin(user.email, env) || await isDisasterAdmin(user.email, env.DB, incident.id);
  if (!self && !privileged) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare(`
    INSERT INTO pastor_disaster_status
      (incident_id, pastor_id, status, note, property_damage_residence, property_damage_church, notify_coordination, confirmed_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(incident_id, pastor_id) DO UPDATE SET
      status = excluded.status, note = excluded.note,
      property_damage_residence = excluded.property_damage_residence,
      property_damage_church = excluded.property_damage_church,
      notify_coordination = excluded.notify_coordination,
      confirmed_by = excluded.confirmed_by, updated_at = datetime('now')
  `).bind(
    incident.id, pastorId, status, note ?? null,
    propertyDamageResidence ? 1 : 0, propertyDamageChurch ? 1 : 0, notifyCoordination ? 1 : 0,
    user.email
  ).run();

  if (notifyCoordination) {
    const to = incident.coordination_emails || env.ADMIN_EMAILS;
    const pastorRow = self ?? await env.DB.prepare('SELECT display_name FROM pastors WHERE id = ?').bind(pastorId).first();
    const damageFlag = propertyDamageResidence || propertyDamageChurch;
    const subject = `${damageFlag ? '[Property Damage] ' : ''}${incident.name}: ${pastorRow?.display_name ?? pastorId} — ${status.toUpperCase()}`;
    const lines = [
      incident.is_simulation ? '*** THIS IS A SIMULATION / DRILL — NOT AN ACTUAL INCIDENT ***' : null,
      `Status: ${status}`,
      `Reported by: ${user.email}${self ? '' : ' (on behalf of ' + (pastorRow?.display_name ?? pastorId) + ')'}`,
      propertyDamageResidence ? 'Property damage reported at residence.' : null,
      propertyDamageChurch    ? 'Property damage reported at church.'    : null,
      note ? `Note: ${note}` : null,
    ].filter(Boolean);
    try {
      await sendEmail(env, { to, subject, text: lines.join('\n') });
    } catch (err) {
      // Status is already saved; don't fail the request over a notification hiccup.
      console.error('disaster status notify failed', err);
    }
  }

  return json({ ok: true });
}
