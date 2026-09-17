import { isAdmin, isDisasterAdmin, isStandingDisasterAdmin } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// A claim older than this is treated as abandoned (tab closed, forgot to
// log an outcome) and silently released back to the pool for anyone else.
const CLAIM_STALE_MINUTES = 20;

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

function claimJson(row) {
  if (!row) return null;
  return {
    pastorId:    row.id,
    displayName: row.display_name,
    email:       row.email,
    phone:       row.primary_phone,
    claimedAt:   row.claimed_at,
  };
}

// GET — returns the requesting user's current in-progress claim for the
// active incident, if any, so reopening/refreshing the dashboard doesn't
// lose track of who they were already calling.
export async function onRequestGet({ env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ claim: null });
  if (!await isPrivileged(user, env, incident.id)) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare(
    `DELETE FROM pastor_disaster_claims WHERE incident_id = ? AND claimed_at < datetime('now', ?)`
  ).bind(incident.id, `-${CLAIM_STALE_MINUTES} minutes`).run();

  const row = await env.DB.prepare(`
    SELECT p.id, p.display_name, p.email, p.primary_phone, c.claimed_at
    FROM pastor_disaster_claims c JOIN pastors p ON p.id = c.pastor_id
    WHERE c.incident_id = ? AND c.claimed_by = ?
  `).bind(incident.id, user.email).first();

  return json({ claim: claimJson(row) });
}

// POST — claims the next pastor in the pool (active, not already OK/NOT OK
// for this incident, not currently claimed by anyone) for the requesting
// user. If they already have a claim, that's returned instead of assigning
// a new one, so a double-click can't hand out two people at once.
export async function onRequestPost({ env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);
  if (!await isPrivileged(user, env, incident.id)) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare(
    `DELETE FROM pastor_disaster_claims WHERE incident_id = ? AND claimed_at < datetime('now', ?)`
  ).bind(incident.id, `-${CLAIM_STALE_MINUTES} minutes`).run();

  const existing = await env.DB.prepare(`
    SELECT p.id, p.display_name, p.email, p.primary_phone, c.claimed_at
    FROM pastor_disaster_claims c JOIN pastors p ON p.id = c.pastor_id
    WHERE c.incident_id = ? AND c.claimed_by = ?
  `).bind(incident.id, user.email).first();
  if (existing) return json({ claim: claimJson(existing) });

  // Small retry loop to absorb the rare race where two coordinators claim
  // the same candidate in the same instant — the PRIMARY KEY on
  // (incident_id, pastor_id) makes the loser's INSERT fail cleanly.
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = await env.DB.prepare(`
      SELECT p.id, p.display_name, p.email, p.primary_phone
      FROM pastors p
      WHERE p.active = 1
        AND NOT EXISTS (
          SELECT 1 FROM pastor_disaster_status s
          WHERE s.incident_id = ? AND s.pastor_id = p.id AND s.status IN ('ok', 'not_ok')
        )
        AND NOT EXISTS (
          SELECT 1 FROM pastor_disaster_claims c
          WHERE c.incident_id = ? AND c.pastor_id = p.id
        )
      ORDER BY p.last_name, p.first_name
      LIMIT 1
    `).bind(incident.id, incident.id).first();
    if (!candidate) return json({ claim: null, poolEmpty: true });

    try {
      await env.DB.prepare(
        'INSERT INTO pastor_disaster_claims (incident_id, pastor_id, claimed_by) VALUES (?, ?, ?)'
      ).bind(incident.id, candidate.id, user.email).run();
      return json({ claim: claimJson({ ...candidate, claimed_at: new Date().toISOString() }) });
    } catch {
      // Lost the race for this candidate — loop and pick the next one.
    }
  }
  return json({ error: 'Could not claim a pastor right now — please try again' }, 409);
}

// DELETE — release the current claim without logging an outcome (e.g. the
// wrong person was assigned, or the coordinator is stepping away).
export async function onRequestDelete({ env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ ok: true });
  if (!await isPrivileged(user, env, incident.id)) return json({ error: 'Forbidden' }, 403);

  await env.DB.prepare(
    'DELETE FROM pastor_disaster_claims WHERE incident_id = ? AND claimed_by = ?'
  ).bind(incident.id, user.email).run();
  return json({ ok: true });
}
