import { isAdmin } from '../../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function onRequest({ request, env, data }) {
  const user = data.user;
  if (!user || !isAdmin(user.email, env)) return json({ error: 'Forbidden' }, 403);

  const { method } = request;

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, active, is_simulation, coordination_emails, created_by, created_at, closed_at FROM disaster_incidents ORDER BY created_at DESC'
    ).all();
    return json(results);
  }

  if (method === 'POST') {
    const { name, coordinationEmails, isSimulation } = await request.json().catch(() => ({}));
    if (!name?.trim()) return json({ error: 'name is required' }, 400);
    const id = crypto.randomUUID();
    // Prefix the name itself so "SIMULATION" is unmistakable everywhere the
    // incident name is displayed (tab title, dashboard, emails) without every
    // consumer needing to separately check the flag.
    const displayName = isSimulation ? `[SIMULATION] ${name.trim()}` : name.trim();
    await env.DB.prepare(
      'INSERT INTO disaster_incidents (id, name, active, is_simulation, coordination_emails, created_by) VALUES (?, ?, 1, ?, ?, ?)'
    ).bind(id, displayName, isSimulation ? 1 : 0, coordinationEmails || null, user.email).run();
    return json({ ok: true, id });
  }

  if (method === 'PATCH') {
    const { id, active, coordinationEmails } = await request.json().catch(() => ({}));
    if (!id) return json({ error: 'id is required' }, 400);
    if (active === false) {
      await env.DB.prepare("UPDATE disaster_incidents SET active = 0, closed_at = datetime('now') WHERE id = ?").bind(id).run();
    } else {
      if (active === true) {
        await env.DB.prepare('UPDATE disaster_incidents SET active = 1, closed_at = NULL WHERE id = ?').bind(id).run();
      }
      if (coordinationEmails !== undefined) {
        await env.DB.prepare('UPDATE disaster_incidents SET coordination_emails = ? WHERE id = ?').bind(coordinationEmails || null, id).run();
      }
    }
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
