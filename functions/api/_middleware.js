import { getSessionFromRequest } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, next, env } = context;
  const { pathname } = new URL(request.url);
  // /api/confirm is opened from follow-up emails and authorizes by token;
  // /api/cron/ is called by the sync worker and authorizes by CRON_SECRET.
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/') || pathname === '/api/confirm') return next();

  const user = await getSessionFromRequest(request, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  context.data.user = user;
  return next();
}
