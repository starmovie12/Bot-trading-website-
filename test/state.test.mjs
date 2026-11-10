import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { demoState, sign, validateState, verifyPush } from "../lib/state.mjs";
import { handle } from "../api/state.mjs";

const KEY = "test-key-not-a-real-key";
const TS = 1731220000000;
const BODY = '{"mode":"paper"}';

test("golden vector: Python (tests/test_login.py) aur website ek hi signature banayein", () => {
  assert.equal(sign(KEY, TS, BODY), "8d83640c12bb02bb89809ef3960d4d8ceb698b5baae7dbad33893701184a46fd");
});

test("signature jaanch: sahi, galat, purana, bina key", () => {
  const sig = `v1=${sign(KEY, TS, BODY)}`;
  const base = { key: KEY, timestampHeader: String(TS), signatureHeader: sig, bodyText: BODY, nowMs: TS + 1000 };
  assert.deepEqual(verifyPush(base), { ok: true });
  assert.equal(verifyPush({ ...base, bodyText: '{"mode":"real"}' }).ok, false);
  assert.equal(verifyPush({ ...base, nowMs: TS + 6000 }).ok, false); // Command_Max_Umar 5 s se purana
  assert.equal(verifyPush({ ...base, signatureHeader: "v1=abcd" }).ok, false);
  assert.equal(verifyPush({ ...base, signatureHeader: sign(KEY, TS, BODY) }).ok, false); // version prefix nahi
  assert.equal(verifyPush({ ...base, key: undefined }).ok, false);
  assert.equal(verifyPush({ ...base, timestampHeader: "abc" }).ok, false);
});

test("demo haalat saaf NAKLI aur sahi dhaanche mein", () => {
  const s = demoState(TS);
  assert.equal(s.demo, true);
  assert.deepEqual(validateState(s), []);
  assert.deepEqual(Object.keys(s.indices), ["BankNifty", "Nifty50", "Sensex"]);
});

test("galat haalat pakdi jaati hai", () => {
  assert.ok(validateState(null).length > 0);
  assert.ok(validateState({ ...demoState(TS), mode: "live" }).length > 0);
  const s = demoState(TS);
  delete s.indices.Sensex;
  assert.ok(validateState(s).some((e) => e.includes("Sensex")));
});

test("GET /api/state NAKLI haalat deta hai, cache nahi", async () => {
  const r = await handle(new Request("https://x.vercel.app/api/state"), {}, () => TS);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await r.json()).demo, true);
});

test("POST bina key 503, galat signature 401, sahi signature par bhi store nahi (501)", async () => {
  const req = (headers) => new Request("https://x.vercel.app/api/state", { method: "POST", body: JSON.stringify(demoState(TS)), headers });
  assert.equal((await handle(req({}), {}, () => TS)).status, 503);
  const env = { DASHBOARD_PUSH_KEY: KEY };
  assert.equal((await handle(req({ "x-bot-timestamp": String(TS), "x-bot-signature": "v1=00" }), env, () => TS)).status, 401);
  const body = JSON.stringify(demoState(TS));
  const good = new Request("https://x.vercel.app/api/state", {
    method: "POST",
    body,
    headers: { "x-bot-timestamp": String(TS), "x-bot-signature": `v1=${sign(KEY, TS, body)}` },
  });
  assert.equal((await handle(good, env, () => TS + 500)).status, 501);
  assert.equal((await handle(new Request("https://x.vercel.app/api/state", { method: "DELETE" }), env)).status, 405);
});

test("vercel.json mein sakht security headers", () => {
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
  const all = Object.fromEntries(cfg.headers.find((h) => h.source === "/(.*)").headers.map((h) => [h.key, h.value]));
  assert.match(all["Content-Security-Policy"], /script-src 'self'/);
  assert.doesNotMatch(all["Content-Security-Policy"], /unsafe-inline|unsafe-eval/);
  assert.equal(all["X-Frame-Options"], "DENY");
  assert.ok(all["Strict-Transport-Security"]);
});

test("page par inline script ya innerHTML nahi (XSS se bachav)", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(js, /innerHTML|eval\(|new Function/);
});




test("vercel.json: framework Other, koi install/build nahi, output public", () => {
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
  assert.equal(cfg.framework, null);
  assert.equal(cfg.installCommand, "");
  assert.equal(cfg.buildCommand, undefined);
  assert.equal(cfg.outputDirectory, "public");
});

test("is repo mein sirf website: koi bot code, chaabi ya TLS-off code nahi", () => {
  const root = new URL("..", import.meta.url).pathname;
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === ".git" || n === "node_modules") continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(root);
  assert.ok(!files.some((f) => /\.(py|go)$/.test(f)), "bot ka Python/Go code website repo mein nahi");
  const tlsOff = /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|CERT_NONE/;
  const secret = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}/i;
  for (const f of files.filter((f) => /\.(mjs|js|json|html)$/.test(f) && !f.includes("/test/"))) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, tlsOff, f);
    assert.doesNotMatch(text, secret, f);
  }
});
