export async function getLastSync(env) {
  const row = await env.DB.prepare(
    "SELECT value FROM meta WHERE key = 'eadventist_last_sync'"
  ).first();
  return row?.value ?? null;
}

export async function setLastSync(env) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('eadventist_last_sync', ?)"
  ).bind(now).run();
}

export async function bumpDataVersion(env) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('version', ?)"
  ).bind(now).run();
}

export async function logSync(env, syncType, action, entityName, details) {
  await env.DB.prepare(
    'INSERT INTO sync_log (sync_type, action, entity_name, details) VALUES (?, ?, ?, ?)'
  ).bind(syncType, action, entityName ?? null, JSON.stringify(details ?? {})).run();
}

export function formatFromDate(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
