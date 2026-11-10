// Dashboard ka shared logic: bot ki haalat ka dhaancha aur signature jaanch.
// Bot (src/bot/dashboard_push.py) bhi yahi signature banata hai; golden vector dono ke tests mein hai.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_VERSION = "v1";
export const PUSH_MAX_AGE_MS = 5000; // Command_Max_Umar (idea v4): purana signature nahi
export const MAX_BODY_BYTES = 64 * 1024;
export const INDICES = ["BankNifty", "Nifty50", "Sensex"];
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

// Abhi bot juda nahi hai, isliye website sirf NAKLI haalat dikhati hai (saaf banner ke saath).
export function demoState(nowMs) {
  return {
    demo: true,
    generatedAtMs: nowMs,
    mode: "paper",
    running: false,
    milestone: "M1 shuru: bot abhi broker se juda nahi",
    mausam: "Tay nahi",
    zone: "Tay nahi",
    entriesLeft: null,
    dailyLossUsedPct: null,
    profitLock: false,
    gates: ["Bot band"],
    warning: "Nakli data: bot abhi Dashboard ko haalat nahi bhej raha",
    indices: Object.fromEntries(INDICES.map((i) => [i, { call: "NA", put: "NA", reason: "Bot band" }])),
    openTrades: [],
  };
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
  return errors;
}
