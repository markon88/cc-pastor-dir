export async function onRequest(context) {
  return new Response(JSON.stringify({ version: "2026-03" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
