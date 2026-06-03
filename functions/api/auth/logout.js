export async function onRequestPost({ request }) {
  const secure = new URL(request.url).hostname === 'localhost' ? '' : '; Secure';
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie':   `session=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`,
    },
  });
}
