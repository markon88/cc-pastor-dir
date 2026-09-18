import { getSessionFromRequest } from '../../_lib/auth.js';

// Marks one announcement/tour id as seen for the current user, so it never
// resurfaces for them again — on any device, since this is DB-backed rather
// than a per-device localStorage flag. See migrations/017_seen_announcements.sql.
export async function onRequestPost({ request, env }) {
  const user = await getSessionFromRequest(request, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null);
  const id   = body?.id;
  if (!id || typeof id !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO seen_announcements (email, announcement_id) VALUES (?, ?)'
      ).bind(user.email, id).run();
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
