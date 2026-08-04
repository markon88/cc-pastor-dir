// Streams a disaster photo from R2. Gated by the existing session middleware
// (functions/api/_middleware.js) — any logged-in directory user can view, but
// the bucket itself is private and keys are only ever handed out via photos.js.
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return new Response('Missing key', { status: 400 });

  const row = await env.DB.prepare('SELECT 1 FROM disaster_photos WHERE r2_key = ?').bind(key).first();
  if (!row) return new Response('Not found', { status: 404 });

  const object = await env.DISASTER_PHOTOS.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
