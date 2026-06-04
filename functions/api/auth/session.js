import { getSessionFromRequest, signJWT, isAdmin, sessionCookieHeader } from '../../_lib/auth.js';

function detectPlatform(ua) {
  if (!ua) return null;
  if (/iPhone/.test(ua))  return 'iPhone';
  if (/iPad/.test(ua))    return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android Phone' : 'Android Tablet';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua))   return 'Linux';
  return 'Unknown';
}

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

  if (env.DB) {
    const appVersion = request.headers.get('X-App-Version') ?? null;
    const platform   = detectPlatform(request.headers.get('User-Agent'));
    try {
      await env.DB.prepare(`
        INSERT INTO user_activity (email, name, picture, first_login, last_login, last_seen, login_count, open_count, app_version, platform)
        VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), 0, 1, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          name        = excluded.name,
          picture     = excluded.picture,
          last_seen   = datetime('now'),
          open_count  = open_count + 1,
          app_version = excluded.app_version,
          platform    = excluded.platform
      `).bind(user.email, user.name ?? null, user.picture ?? null, appVersion, platform).run();
    } catch {}
  }

  return new Response(JSON.stringify({
    email:   user.email,
    name:    user.name,
    picture: user.picture,
    isAdmin: isAdmin(user.email, env),
  }), { headers });
}
