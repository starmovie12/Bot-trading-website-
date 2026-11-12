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

const jsFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) out.push(p);
    }
  };
  walk(new URL("../public/js", import.meta.url).pathname);
  return out;
};

test("page par inline script ya innerHTML nahi (XSS se bachav)", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(html, /\son[a-z]+="/, "HTML mein inline event handler nahi");
  const files = jsFiles();
  assert.ok(files.length >= 6);
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
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

// ---------- Naya terminal (11 Nov 2026) ----------
import { MAX_BODY_BYTES } from "../lib/state.mjs";
import { marketStatus, nextTokenExpiryMs, sessionDayMs, SESSION } from "../lib/market.mjs";

const IST = (iso) => Date.parse(`${iso}+05:30`);

test("market ka samay (IST): khula, pre-open, band, weekend", () => {
  assert.equal(marketStatus(IST("2026-11-11T10:00:00")), "khula");
  assert.equal(marketStatus(IST("2026-11-11T09:05:00")), "pre-open");
  assert.equal(marketStatus(IST("2026-11-11T16:00:00")), "band");
  assert.equal(marketStatus(IST("2026-11-14T11:00:00")), "band"); // shanivaar
  // Somvaar subah 8 baje: pichhla market din shukravaar
  assert.equal(sessionDayMs(IST("2026-11-16T08:00:00")), IST("2026-11-13T00:00:00"));
  assert.equal(SESSION.openMin, 9 * 60 + 15);
});

test("Upstox token agle 3:30 AM IST par khatam", () => {
  assert.equal(nextTokenExpiryMs(IST("2026-11-11T09:00:00")), IST("2026-11-12T03:30:00"));
  assert.equal(nextTokenExpiryMs(IST("2026-11-11T02:00:00")), IST("2026-11-11T03:30:00"));
});

test("demo haalat: ek hi samay par hamesha same, dhaancha sahi, bot ki push seema ke andar", () => {
  const t = IST("2026-11-11T11:20:00");
  const a = demoState(t);
  assert.deepEqual(demoState(t), a);
  assert.deepEqual(validateState(a), []);
  assert.ok(Buffer.byteLength(JSON.stringify(a)) < MAX_BODY_BYTES, "bot isi dhaanche ko push kar sake");
  assert.equal(a.market.status, "khula");
  for (const n of ["Nifty50", "BankNifty", "Sensex"]) {
    const cs = a.candles.series[n];
    assert.ok(cs.length > 0 && cs.length <= 75);
    assert.equal(cs[0][0], IST("2026-11-11T09:15:00"));
    for (const [, o, h, l, c] of cs) assert.ok(h >= Math.max(o, c) && l <= Math.min(o, c));
    const ch = a.chain[n];
    assert.equal(ch.rows.length, 15);
    assert.equal(ch.rows[7].strike, ch.atm);
    assert.ok(ch.rows.every((r) => r.ce.ltp >= 0.05 && r.pe.ltp >= 0.05));
  }
  const p = a.pnl;
  assert.ok(Math.abs(p.net - (p.realised + p.unrealised - p.charges)) < 0.02);
  assert.ok(a.entriesLeft >= 0 && a.entriesLeft <= a.maxEntries);
  assert.ok(a.positions.length <= 1, "bot ek samay par sirf 1 lot");
});

test("market band hone par poore din ki 75 candles aur koi khula position nahi", () => {
  const s = demoState(IST("2026-11-14T11:00:00"));
  assert.equal(s.market.status, "band");
  assert.equal(s.market.today, false);
  assert.equal(s.candles.series.Nifty50.length, 75);
  assert.equal(s.positions.length, 0);
  assert.equal(s.health.feed.ok, false);
});

test("galat candle (high close se neeche) pakdi jaati hai", () => {
  const s = demoState(IST("2026-11-11T11:20:00"));
  s.candles.series.Nifty50[0] = [1, 100, 90, 80, 95];
  assert.ok(validateState(s).some((e) => e.includes("candle")));
  assert.ok(validateState({ ...demoState(IST("2026-11-11T11:20:00")), orders: "x" }).some((e) => e.includes("orders")));
});

test("page: 5 views, menu, manifest; har script/style apni hi site se", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const views = ["home", "chart", "chain", "trades", "health", "controls", "activity", "settings", "setup"];
  for (const v of views) {
    assert.match(html, new RegExp(`data-view="${v}"`));
    assert.match(html, new RegExp(`href="#${v}" data-nav="${v}"`), `${v} ka menu link`);
  }
  // Har menu link ka page hona chahiye (koi toota link nahi)
  for (const [, v] of html.matchAll(/data-nav="([a-z]+)"/g)) assert.ok(v === "more" || views.includes(v), v);
  // Har id ek hi baar
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  // JS jo id dhoondhta hai woh HTML mein hai
  for (const f of jsFiles()) for (const [, id] of readFileSync(f, "utf8").matchAll(/\$\("([a-z0-9-]+)"\)/g)) assert.ok(ids.includes(id), `${f}: #${id} HTML mein nahi`);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
  assert.match(html, /NAKLI DATA/);
  const m = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(m.start_url, "/#home");
});
