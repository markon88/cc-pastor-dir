// Saves (or clears) the signed-in pastor's personal AMA preference — which
// AMA they participate in, overriding the one derived from their churches.
// See migrations/021_pastor_ama_preferences.sql. Body: { groupId } to set,
// { groupId: null } to go back to their churches' AMA. Choosing is always
// optional — with no saved preference a pastor stays on their churches' AMA.
//
// Whenever a pastor's chosen AMA changes — a different AMA than their
// churches', one of several when their churches span more than one AMA, or
// back to their churches' AMA — the conference's AMA coordinator is emailed so
// they can keep the pastor updated on schedule changes for that AMA.
// AMA_PREF_NOTIFY_EMAIL overrides the default recipient.
import { sendEmail, renderEmail } from '../_lib/email.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env, data }) {
  const user = data.user;

  const body = await request.json().catch(() => null);
  if (!body || !('groupId' in body)) return json({ error: 'Missing groupId' }, 400);
  const groupId = body.groupId;

  // Same lookup the client uses for "my pastor record": the directory email
  // an admin mapped this login to, else the login email itself.
  const mapping = await env.DB.prepare('SELECT directory_email FROM allowed_emails WHERE email = ?')
    .bind(user.email).first();
  const lookupEmail = (mapping?.directory_email ?? user.email).toLowerCase();
  const pastor = await env.DB.prepare('SELECT id, display_name FROM pastors WHERE active = 1 AND LOWER(email) = ?')
    .bind(lookupEmail).first();
  if (!pastor) return json({ error: 'No pastor record is linked to this account' }, 404);

  if (groupId !== null && typeof groupId !== 'string') return json({ error: 'Invalid groupId' }, 400);

  const [{ results: groupRows }, { results: churchGroupRows }, previous] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM ama_groups').all(),
    env.DB.prepare(`
      SELECT DISTINCT cag.group_id
      FROM pastor_churches pc JOIN church_ama_groups cag ON cag.church_org_code = pc.church_org_code
      WHERE pc.pastor_id = ?
    `).bind(pastor.id).all(),
    env.DB.prepare('SELECT group_id FROM pastor_ama_preferences WHERE pastor_id = ?').bind(pastor.id).first(),
  ]);
  const groupName = Object.fromEntries(groupRows.map(g => [g.id, g.name]));
  if (groupId !== null && !groupName[groupId]) return json({ error: 'Unknown AMA group' }, 400);

  const assignedIds = churchGroupRows.map(r => r.group_id);
  // Picking one of the churches' own AMAs is only a real preference when the
  // churches span more than one AMA — otherwise it's the same as no choice,
  // so nothing is stored and the pastor keeps following their churches.
  const effectiveGroupId = groupId !== null && !(assignedIds.length === 1 && assignedIds[0] === groupId)
    ? groupId
    : null;

  if (effectiveGroupId === null) {
    await env.DB.prepare('DELETE FROM pastor_ama_preferences WHERE pastor_id = ?').bind(pastor.id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO pastor_ama_preferences (pastor_id, group_id, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(pastor_id) DO UPDATE SET group_id = excluded.group_id, updated_at = excluded.updated_at
    `).bind(pastor.id, effectiveGroupId).run();
  }

  const prevId = previous?.group_id ?? null;
  if (prevId !== effectiveGroupId) {
    await notifyCoordinator(env, {
      pastorName: pastor.display_name,
      assigned:   assignedIds.map(id => groupName[id]).filter(Boolean).join(' & ') || 'None',
      previous:   prevId ? groupName[prevId] ?? prevId : null,
      chosen:     effectiveGroupId ? groupName[effectiveGroupId] : null,
    });
  }

  // Bump the data version so every client (including this pastor's other
  // devices) refetches /api/data and sees the new My AMA / banner / roster.
  await env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('version', ?)")
    .bind(new Date().toISOString()).run();

  return json({ ok: true });
}

// Best-effort — the preference is already saved, so a mail hiccup never
// blocks the pastor's change.
async function notifyCoordinator(env, { pastorName, assigned, previous, chosen }) {
  const to = env.AMA_PREF_NOTIFY_EMAIL || 'acase@carolinasda.org';
  const subject = chosen
    ? `[CC Pastors] ${pastorName} chose the ${chosen} AMA`
    : `[CC Pastors] ${pastorName} returned to their assigned AMA`;
  const { html, text } = renderEmail({
    title: subject,
    heading: chosen ? 'AMA participation changed' : 'AMA participation reset',
    rows: [
      { label: 'Pastor', value: pastorName },
      { label: 'Assigned AMA (by churches)', value: assigned },
      ...(previous ? [{ label: 'Previously chose', value: previous }] : []),
      { label: 'Now participating in', value: chosen ?? `${assigned} (assigned)` },
    ],
    paragraphs: ['Please keep this pastor updated on any schedule changes affecting the AMA they participate in.'],
    footer: 'Sent because a pastor changed their AMA on My AMA Schedule in CC Pastors.',
  });
  try {
    await sendEmail(env, { to, subject, html, text });
  } catch (err) {
    console.error('AMA preference notify failed', err);
  }
}
