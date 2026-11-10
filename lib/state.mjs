// Dashboard ka shared logic: bot ki haalat ka dhaancha aur signature jaanch.
// Bot (src/bot/dashboard_push.py) bhi yahi signature banata hai; golden vector dono ke tests mein hai.
import { createHmac, timingSafeEqual } from "node:crypto";
import { INDICES, demoState } from "./demo.mjs";

// Purane imports na tootein: INDICES aur demoState yahan se bhi milte hain.
export { INDICES, demoState };

export const SIGNATURE_VERSION = "v1";
export const PUSH_MAX_AGE_MS = 5000; // Command_Max_Umar (idea v4): purana signature nahi
export const MAX_BODY_BYTES = 64 * 1024;
const MODES = ["paper", "real"];

export function sign(key, timestampMs, bodyText) {
  return createHmac("sha256", key).update(`${timestampMs}.`).update(bodyText).digest("hex");
}

export function verifyPush({ key, timestampHeader, signatureHeader, bodyText, nowMs, maxAgeMs = PUSH_MAX_AGE_MS }) {
  if (!key) return { ok: false, reason: "DASHBOARD_PUSH_KEY set nahi" };
  if (typeof bodyText !== "string" || Buffer.byteLength(bodyText) > MAX_BODY_BYTES) {
    return { ok: false, reason: "body galat ya bahut badi" };
  }
  const ts = Number(timestampHeader);
  if (!Number.isSafeInteger(ts) || ts <= 0) return { ok: false, reason: "timestamp galat" };
  if (Math.abs(nowMs - ts) > maxAgeMs) return { ok: false, reason: "purana ya aage ka timestamp" };
  if (typeof signatureHeader !== "string" || !signatureHeader.startsWith(`${SIGNATURE_VERSION}=`)) {
    return { ok: false, reason: "signature ka format galat" };
  }
  const got = Buffer.from(signatureHeader.slice(SIGNATURE_VERSION.length + 1), "hex");
  const want = Buffer.from(sign(key, ts, bodyText), "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: "signature galat" };
  return { ok: true };
}

export function validateState(s) {
  const errors = [];
  if (typeof s !== "object" || s === null || Array.isArray(s)) return ["object chahiye"];
  if (typeof s.demo !== "boolean") errors.push("demo true/false");
  if (!Number.isSafeInteger(s.generatedAtMs) || s.generatedAtMs <= 0) errors.push("generatedAtMs galat");
  if (!MODES.includes(s.mode)) errors.push("mode sirf paper/real");
  if (typeof s.running !== "boolean") errors.push("running true/false");
  if (typeof s.indices !== "object" || s.indices === null) errors.push("indices chahiye");
  else for (const i of INDICES) if (!(i in s.indices)) errors.push(`indices.${i} nahi`);
  if (!Array.isArray(s.openTrades)) errors.push("openTrades list chahiye");
  // Naye (optional) hisse: hon toh sahi dhaanche mein hon. Website inhe sirf textContent se dikhati hai.
  if (s.indices && typeof s.indices === "object") {
    for (const i of INDICES) {
      const v = s.indices[i];
      if (v && "ltp" in v && !Number.isFinite(v.ltp)) errors.push(`indices.${i}.ltp number chahiye`);
    }
  }
  if (s.candles !== undefined) {
    const series = s.candles && s.candles.series;
    if (typeof series !== "object" || series === null) errors.push("candles.series chahiye");
    else {
      for (const [name, list] of Object.entries(series)) {
        if (!INDICES.includes(name) || !Array.isArray(list) || list.length > 500) {
          errors.push(`candles.${name} galat`);
          continue;
        }
        const bad = list.some(
          (c) => !Array.isArray(c) || c.length !== 5 || !c.every(Number.isFinite) || c[2] < Math.max(c[1], c[4]) || c[3] > Math.min(c[1], c[4]),
        );
        if (bad) errors.push(`candles.${name} mein galat candle (t,o,h,l,c)`);
      }
    }
  }
  for (const k of ["positions", "orders", "tradeBook", "events"]) {
    if (s[k] !== undefined && (!Array.isArray(s[k]) || s[k].length > 200)) errors.push(`${k} list chahiye (200 tak)`);
  }
  return errors;
}
