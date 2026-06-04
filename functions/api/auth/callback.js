import { signJWT, isEmailAllowed, sessionCookieHeader } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const origin = url.origin;

  const cookies    = request.headers.get('Cookie') ?? '';
  const stateMatch = cookies.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  if (!stateMatch || stateMatch[1] !== state) {
    return Response.redirect(`${origin}/?error=invalid_state`, 302);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${origin}/api/auth/callback`,
      grant_type:    'authorization_code',
    }),
  });
  if (!tokenRes.ok) return Response.redirect(`${origin}/?error=token_exchange`, 302);

  const { access_token } = await tokenRes.json();

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) return Response.redirect(`${origin}/?error=userinfo`, 302);

  const { email, name, picture, verified_email } = await userRes.json();
  if (!verified_email) return Response.redirect(`${origin}/?error=unverified`, 302);

  const allowed = await isEmailAllowed(email, env.DB);
  if (!allowed)   return Response.redirect(`${origin}/?error=not_allowed`, 302);

  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO user_activity (email, name, picture, first_login, last_login, last_seen, login_count, open_count)
        VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), 1, 0)
        ON CONFLICT(email) DO UPDATE SET
          name        = excluded.name,
          picture     = excluded.picture,
          last_login  = datetime('now'),
          last_seen   = datetime('now'),
          login_count = login_count + 1
      `).bind(email, name ?? null, picture ?? null).run();
    } catch {}
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 24 * 60 * 60;
  const token = await signJWT({ email, name, picture, iat: now, exp }, env.JWT_SECRET);

  const isLocalhost  = url.hostname === 'localhost';
  const clearState   = `oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

  const headers = new Headers({ Location: `${origin}/` });
  headers.append('Set-Cookie', sessionCookieHeader(token, exp, isLocalhost));
  headers.append('Set-Cookie', clearState);
  return new Response(null, { status: 302, headers });
}
