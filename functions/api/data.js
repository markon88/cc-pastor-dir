export async function onRequestGet({ env }) {
  const [
    { results: pastorRows },
    { results: phoneRows },
    { results: pcRows },
    { results: pgRows },
    { results: churchRows },
    { results: groupRows },
    { results: versionRows },
    { results: meetingRows },
  ] = await env.DB.batch([
    env.DB.prepare('SELECT id, last_name, first_name, display_name, email, birthday, street, city, state, zip, primary_phone FROM pastors WHERE active = 1 ORDER BY last_name, first_name'),
    env.DB.prepare('SELECT pastor_id, number, mobile, confidential FROM pastor_phones'),
    env.DB.prepare('SELECT pastor_id, church_name FROM pastor_churches'),
    env.DB.prepare('SELECT pastor_id, group_id FROM pastor_ama_groups'),
    env.DB.prepare('SELECT name, org_code, street, city, state, zip, membership FROM churches ORDER BY name'),
    env.DB.prepare('SELECT id, name, leader_id FROM ama_groups ORDER BY sort_order, name'),
    env.DB.prepare("SELECT value FROM meta WHERE key = 'version'"),
    env.DB.prepare('SELECT id, group_name, date, type FROM ama_meetings ORDER BY date'),
  ]);

  // Build lookup maps from junction/detail tables
  const phonesByPastor = {};
  for (const r of phoneRows) {
    (phonesByPastor[r.pastor_id] ??= []).push({
      number: r.number,
      mobile: !!r.mobile,
      ...(r.confidential ? { confidential: true } : {}),
    });
  }

  const churchesByPastor = {};
  for (const r of pcRows) {
    (churchesByPastor[r.pastor_id] ??= []).push(r.church_name);
  }

  const groupsByPastor = {};
  const pastorsByGroup = {};
  for (const r of pgRows) {
    (groupsByPastor[r.pastor_id] ??= []).push(r.group_id);
    (pastorsByGroup[r.group_id]  ??= []).push(r.pastor_id);
  }

  const groupNameById = Object.fromEntries(groupRows.map(g => [g.id, g.name]));

  const pastors = pastorRows.map(p => ({
    id:           p.id,
    lastName:     p.last_name,
    firstName:    p.first_name,
    displayName:  p.display_name,
    email:        p.email        ?? null,
    birthday:     p.birthday     ?? null,
    address:      p.street ? { street: p.street, city: p.city, state: p.state, zip: p.zip } : null,
    phones:       phonesByPastor[p.id]   ?? [],
    primaryPhone: p.primary_phone ?? null,
    churches:     churchesByPastor[p.id] ?? [],
    amaGroup:     (groupsByPastor[p.id] ?? []).map(gid => groupNameById[gid]).filter(Boolean),
  }));

  const amaGroups = groupRows.map(g => ({
    id:        g.id,
    name:      g.name,
    leaderId:  g.leader_id ?? null,
    pastorIds: pastorsByGroup[g.id] ?? [],
  }));

  const churchAddresses = {};
  for (const c of churchRows) {
    churchAddresses[c.name] = {
      ...(c.org_code != null ? { orgCode: c.org_code } : {}),
      street: c.street,
      city:   c.city,
      state:  c.state,
      zip:    c.zip,
      ...(c.membership != null ? { membership: c.membership } : {}),
    };
  }

  return new Response(JSON.stringify({
    version:         versionRows[0]?.value ?? '0',
    pastors,
    amaGroups,
    churchAddresses,
    amaSchedule:     meetingRows.map(m => ({ id: m.id, group: m.group_name, date: m.date, type: m.type })),
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
