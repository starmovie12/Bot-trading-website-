// GET /api/health -> website zinda hai ya nahi (koi data nahi)
export default {
  fetch: () =>
    new Response(JSON.stringify({ ok: true, app: "bot-dashboard", version: "0.2.0" }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    }),
};
