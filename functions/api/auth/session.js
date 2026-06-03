import { getSessionFromRequest, signJWT, isAdmin, sessionCookieHeader } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionFromRequest(request, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });

  // Sliding window: renew if fewer than 15 days remain
  const now = Math.floor(Date.now() / 1000);
  if (user.exp - now < 15 * 24 * 60 * 60) {
    const exp   = now + 30 * 24 * 60 * 60;
    const token = await signJWT({ email: user.email, name: user.name, picture: user.picture, iat: now, exp }, env.JWT_SECRET);
    headers.set('Set-Cookie', sessionCookieHeader(token, exp, new URL(request.url).hostname === 'localhost'));
  }

  return new Response(JSON.stringify({
    email:   user.email,
    name:    user.name,
    picture: user.picture,
    isAdmin: isAdmin(user.email, env),
  }), { headers });
}
