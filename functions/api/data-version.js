export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'version'").first();
  return new Response(JSON.stringify({ version: row?.value ?? '0' }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
