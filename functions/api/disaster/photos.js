import { isAdmin, isDisasterAdmin, resolveIdentityEmail } from '../../_lib/auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const MAX_BYTES = 8 * 1024 * 1024;

async function activeIncident(env) {
  return env.DB.prepare(
    'SELECT id FROM disaster_incidents WHERE active = 1 ORDER BY created_at DESC LIMIT 1'
  ).first();
}

async function canEditSubject(email, env, subjectType, subjectId) {
  if (subjectType === 'pastor') {
    const row = await env.DB.prepare('SELECT 1 FROM pastors WHERE id = ? AND email = ?').bind(subjectId, email).first();
    return !!row;
  }
  if (subjectType === 'church') {
    const row = await env.DB.prepare(`
      SELECT 1 FROM pastor_churches pc
      JOIN pastors p ON p.id = pc.pastor_id
      JOIN churches c ON c.org_code = pc.church_org_code
      WHERE p.email = ? AND c.name = ?
    `).bind(email, subjectId).first();
    return !!row;
  }
  return false;
}

export async function onRequestGet({ request, env }) {
  const { searchParams } = new URL(request.url);
  const subjectType = searchParams.get('subjectType');
  const subjectId = searchParams.get('subjectId');
  if (!subjectType || !subjectId) return json({ error: 'subjectType and subjectId are required' }, 400);

  const { results } = await env.DB.prepare(
    'SELECT id, r2_key, caption, uploaded_by, created_at FROM disaster_photos WHERE subject_type = ? AND subject_id = ? ORDER BY created_at DESC'
  ).bind(subjectType, subjectId).all();

  return json(results.map(r => ({
    id: r.id,
    url: `/api/disaster/photo-file?key=${encodeURIComponent(r.r2_key)}`,
    caption: r.caption,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  })));
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;
  const incident = await activeIncident(env);
  if (!incident) return json({ error: 'No active incident' }, 409);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const subjectType = form?.get('subjectType');
  const subjectId = form?.get('subjectId');
  const caption = form?.get('caption');
  if (!(file instanceof File) || !['pastor', 'church'].includes(subjectType) || !subjectId) {
    return json({ error: 'file, subjectType (pastor|church) and subjectId are required' }, 400);
  }
  if (file.size > MAX_BYTES) return json({ error: 'Photo too large (8MB max)' }, 400);
  if (!file.type?.startsWith('image/')) return json({ error: 'Only image uploads are allowed' }, 400);

  const identityEmail = await resolveIdentityEmail(user.email, env.DB);
  const owns = await canEditSubject(identityEmail, env, subjectType, subjectId);
  const privileged = isAdmin(user.email, env) || await isDisasterAdmin(user.email, env.DB, incident.id);
  if (!owns && !privileged) return json({ error: 'Forbidden' }, 403);

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${incident.id}/${subjectType}/${subjectId}/${crypto.randomUUID()}.${ext}`;
  await env.DISASTER_PHOTOS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const inserted = await env.DB.prepare(`
    INSERT INTO disaster_photos (incident_id, subject_type, subject_id, r2_key, caption, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(incident.id, subjectType, subjectId, key, caption || null, user.email).run();

  return json({ ok: true, id: inserted.meta.last_row_id, url: `/api/disaster/photo-file?key=${encodeURIComponent(key)}` });
}
