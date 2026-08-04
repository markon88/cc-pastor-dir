import { isAdmin } from '../../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Grant/revoke temporary, incident-scoped disaster admins. Only permanent
// admins (ADMIN_EMAILS) may grant — a disaster admin cannot chain-grant
// further admins, to avoid uncontrolled privilege escalation mid-incident.
export async function onRequest({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { method } = request;

  if (method === 'GET') {
    const incidentId = new URL(request.url).searchParams.get('incidentId');
    if (!incidentId) return json({ error: 'incidentId is required' }, 400);
    const { results } = await env.DB.prepare(
      'SELECT email, granted_by, granted_at, revoked_at FROM disaster_admins WHERE incident_id = ? ORDER BY granted_at DESC'
    ).bind(incidentId).all();
    return json(results);
  }

  if (method === 'POST') {
    const { incidentId, email } = await request.json().catch(() => ({}));
    if (!incidentId || !email?.includes('@')) return json({ error: 'incidentId and a valid email are required' }, 400);
    await env.DB.prepare(`
      INSERT INTO disaster_admins (incident_id, email, granted_by)
      VALUES (?, ?, ?)
      ON CONFLICT(incident_id, email) DO UPDATE SET granted_by = excluded.granted_by, granted_at = datetime('now'), revoked_at = NULL
    `).bind(incidentId, email.toLowerCase().trim(), user.email).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incidentId');
    const email = searchParams.get('email');
    if (!incidentId || !email) return json({ error: 'incidentId and email are required' }, 400);
    await env.DB.prepare(
      "UPDATE disaster_admins SET revoked_at = datetime('now') WHERE incident_id = ? AND email = ?"
    ).bind(incidentId, email.toLowerCase()).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
