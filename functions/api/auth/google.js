export async function onRequestGet({ request, env }) {
  const { origin, hostname } = new URL(request.url);
  const state    = crypto.randomUUID();
  const secure   = hostname === 'localhost' ? '' : '; Secure';

  const params = new URLSearchParams({
    client_id:     env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${origin}/api/auth/callback`,
    response_type: 'code',
    scope:         'email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location:    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'Set-Cookie': `oauth_state=${state}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
