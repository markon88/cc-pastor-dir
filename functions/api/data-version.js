export async function onRequest(context) {
  return new Response(JSON.stringify({ version: "2026-04" }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
