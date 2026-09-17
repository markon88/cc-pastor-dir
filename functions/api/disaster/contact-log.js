import { isAdmin, isDisasterAdmin, isStandingDisasterAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const OUTCOMES = ['no_answer', 'left_voicemail', 'reached_ok', 'reached_not_ok', 'other'];
// Outcomes that actually resolve the person's status, moving them out of
// the "still needs checking" pool for good rather than back into it.
const RESOLVES_TO_STATUS = { reached_ok: 'ok', reached_not_ok: 'not_ok' };

async function activeIncident(env) {
  return env.DB.prepare(
    'SELECT id, name FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();
}

async function isPrivileged(user, env, incidentId) {
  return isAdmin(user.email, env)
    || await isStandingDisasterAdmin(user.email, env.DB)
    || await isDisasterAdmin(user.email, env.DB, incidentId);
}

// GET — the most recent contact attempt per pastor, for showing "Last
// attempt: no answer, 12m ago by X" alongside the roster.
export async function onRequestGet({ env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ attempts: [] });
  if (!await isPrivileged(user, env, incident.id)) return json({ error: 'Forbidden' }, 403);

  const { results } = await env.DB.prepare(`
    SELECT pastor_id, outcome, note, logged_by, logged_at
    FROM pastor_disaster_contact_log
    WHERE incident_id = ? AND id IN (
      SELECT MAX(id) FROM pastor_disaster_contact_log WHERE incident_id = ? GROUP BY pastor_id
    )
  `).bind(incident.id, incident.id).all();

  return json({
    attempts: results.map(r => ({
      pastorId: r.pastor_id, outcome: r.outcome, note: r.note,
      loggedBy: r.logged_by, loggedAt: r.logged_at,
    })),
  });
}

// POST — records one contact attempt (always, regardless of outcome) and
// releases the claim on that pastor. An outcome that actually reaches the
// person also updates their disaster status directly, same as if they'd
// self-reported; other outcomes (no answer, voicemail) leave their status
// alone so they stay in the "still needs checking" pool for a retry.
export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);
  if (!await isPrivileged(user, env, incident.id)) return json({ error: 'Forbidden' }, 403);

  const { pastorId, outcome, note } = await request.json().catch(() => ({}));
  if (!pastorId || !OUTCOMES.includes(outcome)) {
    return json({ error: 'pastorId and a valid outcome are required' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO pastor_disaster_contact_log (incident_id, pastor_id, outcome, note, logged_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(incident.id, pastorId, outcome, note?.trim() || null, user.email).run();

  await env.DB.prepare(
    'DELETE FROM pastor_disaster_claims WHERE incident_id = ? AND pastor_id = ?'
  ).bind(incident.id, pastorId).run();

  const resolvedStatus = RESOLVES_TO_STATUS[outcome];
  if (resolvedStatus) {
    await env.DB.prepare(`
      INSERT INTO pastor_disaster_status (incident_id, pastor_id, status, confirmed_by, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(incident_id, pastor_id) DO UPDATE SET
        status = excluded.status, confirmed_by = excluded.confirmed_by, updated_at = datetime('now')
    `).bind(incident.id, pastorId, resolvedStatus, user.email).run();
  }

  return json({ ok: true });
}
