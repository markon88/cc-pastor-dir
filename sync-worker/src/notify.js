export async function notify(env, newChurches, newPastors, unmatchedPastors, deactivatedPastors) {
  if (!env.NOTIFY_WEBHOOK_URL) return;

  const lines = [];
  if (newChurches.length > 0) {
    lines.push(`🏛 ${newChurches.length} new congregation(s) auto-inserted:`);
    for (const c of newChurches) lines.push(`  • ${c.name} (${c.orgCode})`);
  }
  if (newPastors.length > 0) {
    lines.push(`🎉 ${newPastors.length} new pastor(s) auto-inserted — review and fill in details:`);
    for (const p of newPastors) lines.push(`  • ${p.firstName} ${p.lastName} (eID ${p.eId})`);
  }
  if (unmatchedPastors.length > 0) {
    lines.push(`👤 ${unmatchedPastors.length} pastor(s) in eAdventist with no directory match:`);
    for (const p of unmatchedPastors) lines.push(`  • ${p.firstName} ${p.lastName} (eID ${p.eId})`);
  }
  const dropped   = deactivatedPastors?.filter(p => p.reason !== 'no_church') ?? [];
  const noChurch  = deactivatedPastors?.filter(p => p.reason === 'no_church') ?? [];
  if (dropped.length > 0) {
    lines.push(`🚪 ${dropped.length} pastor(s) deactivated — no longer listed in eAdventist:`);
    for (const p of dropped) lines.push(`  • ${p.firstName} ${p.lastName} (eID ${p.eId})`);
  }
  if (noChurch.length > 0) {
    lines.push(`🚪 ${noChurch.length} pastor(s) deactivated — still in eAdventist but no church association:`);
    for (const p of noChurch) lines.push(`  • ${p.firstName} ${p.lastName} (eID ${p.eId})`);
  }

  await fetch(env.NOTIFY_WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text:  `eAdventist sync needs review — ${lines[0]}`,
      items: lines,
    }),
  });
}
