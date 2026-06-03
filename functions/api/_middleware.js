import { getSessionFromRequest } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, next, env } = context;
  if (new URL(request.url).pathname.startsWith('/api/auth/')) return next();

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
