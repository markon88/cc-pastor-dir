// Streams a pastor headshot from R2. Gated by the existing session middleware
// (functions/api/_middleware.js) — any logged-in directory user can view.
// Keys are deterministic: pastors/<id>/thumb.jpg (200x200, served by default)
// and pastors/<id>/full.jpg (original resolution, kept for possible future
// tap-to-enlarge but not linked anywhere yet).
export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const size = searchParams.get('size') === 'full' ? 'full' : 'thumb';
  if (!id) return new Response('Missing id', { status: 400 });

  const row = await env.DB.prepare('SELECT 1 FROM pastors WHERE id = ?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });

  const key = `pastors/${id}/${size}.jpg`;
  const object = await env.PASTOR_PHOTOS.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
