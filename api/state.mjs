// GET  /api/state  -> haalat (abhi NAKLI, jab tak store tay na ho)
// POST /api/state  -> bot ki signed haalat (HMAC). Store abhi tay nahi, isliye 501.
import { demoState, validateState, verifyPush } from "../lib/state.mjs";

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

export async function handle(request, env = process.env, now = Date.now) {
  if (request.method === "GET") return json(demoState(now()));
  if (request.method !== "POST") return json({ error: "method allowed nahi" }, 405);
  const bodyText = await request.text();
  const check = verifyPush({
    key: env.DASHBOARD_PUSH_KEY,
    timestampHeader: request.headers.get("x-bot-timestamp"),
    signatureHeader: request.headers.get("x-bot-signature"),
    bodyText,
    nowMs: now(),
  });
  if (!check.ok) return json({ error: check.reason }, env.DASHBOARD_PUSH_KEY ? 401 : 503);
  let state;
  try {
    state = JSON.parse(bodyText);
  } catch {
    return json({ error: "JSON galat" }, 400);
  }
  const errors = validateState(state);
  if (errors.length > 0) return json({ error: "haalat galat", errors }, 422);
  return json({ error: "store abhi tay nahi (M7): haalat save nahi hui" }, 501);
}

export default { fetch: (request) => handle(request) };
