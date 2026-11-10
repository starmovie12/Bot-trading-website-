// NAKLI (demo) haalat: jab tak bot juda nahi, website yahi dikhati hai, upar saaf "NAKLI DATA" banner ke saath.
// Sab kuch ek seed (index + din) se banta hai, isliye ek hi samay par hamesha wahi data aata hai (tests ke liye).
// Yahan ka koi bhi daam, OI, lot ya P&L asli market ka nahi hai.
import {
  SESSION,
  SESSION_NOTE,
  istMidnightMs,
  marketStatus,
  minutesIntoSession,
  nextTokenExpiryMs,
  sessionDayMs,
} from "./market.mjs";

export const INDICES = ["BankNifty", "Nifty50", "Sensex"];
export const INDEX_META = {
  BankNifty: { label: "Bank Nifty", base: 56000, step: 100, vol: 0.00055 },
  Nifty50: { label: "Nifty 50", base: 25000, step: 50, vol: 0.00045 },
  Sensex: { label: "Sensex", base: 82000, step: 100, vol: 0.00045 },
};
// Nakli quantity per lot (sirf P&L ginne ke liye). Asli lot size broker/bot se aayega.
const DEMO_QTY = { BankNifty: 30, Nifty50: 50, Sensex: 20 };
const DEMO_CAPITAL = 15000;
const DEMO_LOSS_LIMIT = 3000;
const MAX_ENTRIES = 3;
const CANDLE_MIN = 5;
const CHARGE_PER_ORDER = 24; // nakli andaza (brokerage + tax)
const SESSION_LEN = SESSION.closeMin - SESSION.openMin;

// Bot ke nakli trades: session ke kitne minute baad entry/exit.
const SCRIPT = [
  { id: "T1", index: "Nifty50", type: "CE", entryMin: 20, exitMin: 65 },
  { id: "T2", index: "BankNifty", type: "PE", entryMin: 95, exitMin: 120 },
  { id: "T3", index: "Sensex", type: "CE", entryMin: 200, exitMin: 330 },
];

const r2 = (x) => Math.round(x * 100) / 100;
const tick = (x) => Math.max(0.05, Math.round(x * 20) / 20); // option daam 0.05 ke step mein

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const pathCache = new Map();
const curveCache = new Map();

// Ek index ka poore din ka minute-by-minute raasta (path[k] = k minute ke ant ka daam).
function dayPath(name, dayMs) {
  const key = `${name}:${dayMs}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const m = INDEX_META[name];
  const r = rng(hash(key));
  const prevClose = m.base * (1 + (r() - 0.5) * 0.04);
  const open = prevClose * (1 + gauss(r) * 0.003);
  const drift = (r() - 0.5) * 0.00008;
  const path = [open];
  const hi = [open];
  const lo = [open];
  let p = open;
  for (let k = 1; k <= SESSION_LEN; k++) {
    const np = p * (1 + drift + gauss(r) * m.vol);
    const wig = Math.abs(gauss(r)) * p * m.vol * 0.5;
    hi.push(Math.max(p, np) + wig);
    lo.push(Math.min(p, np) - wig);
    path.push(np);
    p = np;
  }
  const out = { prevClose, path, hi, lo };
  if (pathCache.size > 24) pathCache.clear();
  pathCache.set(key, out);
  return out;
}

function spotAt(dp, minute) {
  return dp.path[Math.max(0, Math.min(SESSION_LEN, minute))];
}

function liveSpot(name, dp, dayMs, elapsed, nowMs, open) {
  if (!open) return dp.path[elapsed];
  const sec = Math.floor(((nowMs / 1000) % 60) + 60) % 60;
  const a = dp.path[elapsed];
  const b = dp.path[Math.min(SESSION_LEN, elapsed + 1)];
  const r = rng(hash(`${name}:${dayMs}:${Math.floor(nowMs / 5000)}`));
  return a + (b - a) * (sec / 60) + gauss(r) * a * INDEX_META[name].vol * 0.15;
}

function candles(dp, dayMs, elapsed, ltp) {
  const out = [];
  const openMs = dayMs + SESSION.openMin * 60000;
  for (let start = 0; start < Math.max(elapsed, 1); start += CANDLE_MIN) {
    const end = Math.min(start + CANDLE_MIN, Math.max(elapsed, 1));
    let h = -Infinity;
    let l = Infinity;
    for (let k = start + 1; k <= end; k++) {
      h = Math.max(h, dp.hi[k]);
      l = Math.min(l, dp.lo[k]);
    }
    const o = dp.path[start];
    const last = end >= Math.max(elapsed, 1) && elapsed < SESSION_LEN;
    const c = last ? ltp : dp.path[end];
    out.push([openMs + start * 60000, r2(o), r2(Math.max(h, o, c)), r2(Math.min(l, o, c)), r2(c)]);
  }
  return out;
}

function optionPrice(type, spot, strike, step, elapsed) {
  const intrinsic = type === "CE" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const atmTimeValue = spot * 0.0042 * (1 - 0.18 * (elapsed / SESSION_LEN));
  const tv = atmTimeValue * Math.exp(-Math.abs(spot - strike) / (step * 7));
  return tick(intrinsic + tv);
}

function chainFor(name, dp, dayMs, elapsed, spot) {
  const { step } = INDEX_META[name];
  const atm = Math.round(spot / step) * step;
  const openSpot = dp.path[0];
  const frac = Math.max(0.05, elapsed / SESSION_LEN);
  const rows = [];
  for (let k = -7; k <= 7; k++) {
    const strike = atm + k * step;
    const r = rng(hash(`${name}:${dayMs}:${strike}`));
    const round = strike % (step * 10) === 0 ? 1.5 : 1;
    const side = (type) => {
      const ltp = optionPrice(type, spot, strike, step, elapsed);
      const prev = optionPrice(type, openSpot, strike, step, 0);
      const bias = type === "CE" ? k : -k; // call ka OI upar, put ka neeche
      const oi = Math.round((6 + 34 * Math.exp(-(((bias - 2) / 4) ** 2)) + r() * 8) * round * 25000);
      const oiChg = Math.round(oi * (r() - 0.35) * 0.5 * frac);
      const iv = r2(12.5 + Math.abs(k) * 0.45 + r() * 1.2);
      return { ltp, chg: r2(ltp - prev), oi, oiChg, iv };
    };
    rows.push({ strike, ce: side("CE"), pe: side("PE") });
  }
  const ceOi = rows.reduce((a, x) => a + x.ce.oi, 0);
  const peOi = rows.reduce((a, x) => a + x.pe.oi, 0);
  let maxPain = atm;
  let best = Infinity;
  for (const x of rows) {
    let pain = 0;
    for (const y of rows) pain += y.ce.oi * Math.max(0, x.strike - y.strike) + y.pe.oi * Math.max(0, y.strike - x.strike);
    if (pain < best) {
      best = pain;
      maxPain = x.strike;
    }
  }
  return { expiry: "Nakli expiry", spot: r2(spot), atm, step, pcr: r2(peOi / ceOi), maxPain, rows };
}

function ema(values, n) {
  const k = 2 / (n + 1);
  let e = values[0];
  for (const v of values) e = v * k + e * (1 - k);
  return e;
}

function signalFor(name, closes, chain, minute, entriesLeft) {
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const trendPct = ((e9 - e21) / e21) * 100;
  const up = trendPct > 0.02;
  const down = trendPct < -0.02;
  const r = rng(hash(`${name}:breadth:${Math.floor(minute / 15)}`));
  const breadthOk = r() > 0.35;
  const timeOk = minute >= 15 && minute <= SESSION_LEN - 45;
  const checks = [
    { name: "Trend (EMA 9/21)", ok: up || down, note: `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(3)}%` },
    { name: "Breadth (stocks ka saath)", ok: breadthOk, note: breadthOk ? "saath de raha" : "kamzor" },
    { name: "OI / PCR", ok: up ? chain.pcr >= 0.9 : down ? chain.pcr <= 1.1 : null, note: `PCR ${chain.pcr}` },
    { name: "Samay khidki", ok: timeOk, note: timeOk ? "entry allowed" : "entry ka samay nahi" },
    { name: "Premium quality (spread)", ok: true, note: "spread chhota" },
    { name: "Risk limit", ok: entriesLeft > 0, note: `${entriesLeft} entry bachi` },
  ];
  const passed = checks.filter((c) => c.ok === true).length;
  const score = Math.max(0, Math.min(100, Math.round(25 + passed * 12 + Math.min(10, Math.abs(trendPct) * 40))));
  const allOk = checks.every((c) => c.ok !== false);
  const direction = allOk && score >= 70 ? (up ? "CALL" : down ? "PUT" : "WAIT") : "WAIT";
  const failed = checks.find((c) => c.ok === false);
  const reason = direction === "WAIT" ? (failed ? `${failed.name}: ${failed.note}` : "trend saaf nahi") : "saare check pass";
  return { direction, score, checks, reason };
}

function tradesFor(dayMs, elapsed, nowSpot) {
  const openMs = dayMs + SESSION.openMin * 60000;
  const at = (min) => openMs + min * 60000;
  const positions = [];
  const book = [];
  const orders = [];
  let realisedSoFar = 0;
  for (const t of SCRIPT) {
    if (elapsed < t.entryMin) continue;
    if (realisedSoFar <= -DEMO_LOSS_LIMIT * 0.5) continue; // nuksan seema ke paas: nayi entry band
    const meta = INDEX_META[t.index];
    const dp = dayPath(t.index, dayMs);
    const entrySpot = spotAt(dp, t.entryMin);
    const strike = Math.round(entrySpot / meta.step) * meta.step;
    const symbol = `${meta.label} ${strike} ${t.type}`;
    const avg = optionPrice(t.type, entrySpot, strike, meta.step, t.entryMin);
    const qty = DEMO_QTY[t.index];
    const sl = tick(avg * 0.75);
    const target = tick(avg * 1.5);
    orders.push({ id: `${t.id}-B`, atMs: at(t.entryMin), symbol, side: "BUY", kind: "LIMIT", price: avg, status: "COMPLETE", lots: 1 });
    // Bot ka exit: SL ya Target pehle lage toh wahi, warna tay samay par exit.
    let exitMin = t.exitMin;
    let exit = null;
    let reason = "Samay exit (bot)";
    for (let m = t.entryMin + 1; m <= t.exitMin; m++) {
      const px = optionPrice(t.type, spotAt(dp, m), strike, meta.step, m);
      if (px <= sl || px >= target) {
        exitMin = m;
        exit = px <= sl ? sl : target;
        reason = px <= sl ? "Stop-Loss" : "Target";
        break;
      }
    }
    if (elapsed < exitMin) {
      const ltp = optionPrice(t.type, nowSpot[t.index], strike, meta.step, elapsed);
      positions.push({
        id: t.id, index: t.index, symbol, type: t.type, strike, lots: 1, avg, ltp,
        pnl: r2((ltp - avg) * qty), sl, target, entryAtMs: at(t.entryMin), value: r2(avg * qty),
      });
      orders.push({ id: `${t.id}-SL`, atMs: at(t.entryMin), symbol, side: "SELL", kind: "SL-M", price: sl, status: "TRIGGER PENDING", lots: 1 });
    } else {
      if (exit === null) exit = optionPrice(t.type, spotAt(dp, exitMin), strike, meta.step, exitMin);
      const pnl = r2((exit - avg) * qty);
      realisedSoFar += pnl;
      book.push({ id: t.id, index: t.index, symbol, avg, exit, pnl, entryAtMs: at(t.entryMin), exitAtMs: at(exitMin), lots: 1, reason });
      const slHit = reason === "Stop-Loss";
      orders.push({ id: `${t.id}-S`, atMs: at(exitMin), symbol, side: "SELL", kind: slHit ? "SL-M" : "MARKET", price: exit, status: "COMPLETE", lots: 1 });
      if (!slHit) orders.push({ id: `${t.id}-SL`, atMs: at(exitMin), symbol, side: "SELL", kind: "SL-M", price: sl, status: "CANCELLED", lots: 1 });
    }
  }
  orders.sort((a, b) => b.atMs - a.atMs);
  return { positions, book, orders, entriesUsed: book.length + positions.length };
}

const rupees = (v) => `${v >= 0 ? "+" : "\u2212"}\u20b9${Math.abs(v).toFixed(2)}`;

function eventsFor(dayMs, elapsed, trades, signals, status) {
  const openMs = dayMs + SESSION.openMin * 60000;
  const ev = [
    { atMs: dayMs + (8 * 60 + 40) * 60000, level: "good", text: "Upstox login ho gaya (TOTP, khud se)" },
    { atMs: dayMs + 9 * 60 * 60000, level: "good", text: "Subah ki jaanch pass: token, static IP, Pehredaar lease" },
  ];
  if (elapsed > 0 || status !== "band") ev.push({ atMs: openMs, level: "info", text: "Market khula, live feed juda" });
  for (const t of trades.book) {
    ev.push({ atMs: t.entryAtMs, level: "info", text: `Entry: ${t.symbol} 1 lot @ \u20b9${t.avg.toFixed(2)}` });
    ev.push({ atMs: t.exitAtMs, level: t.pnl >= 0 ? "good" : "bad", text: `Exit: ${t.symbol} (${t.reason}) P&L ${rupees(t.pnl)}` });
  }
  for (const p of trades.positions) ev.push({ atMs: p.entryAtMs, level: "info", text: `Entry: ${p.symbol} 1 lot @ \u20b9${p.avg.toFixed(2)}` });
  if (elapsed >= 140) {
    ev.push({ atMs: openMs + 140 * 60000, level: "warn", text: `Bank Nifty: WAIT (${signals.BankNifty.reason})` });
  }
  if (elapsed >= SESSION_LEN) ev.push({ atMs: openMs + SESSION_LEN * 60000, level: "info", text: "Market band: aaj ka report bana" });
  return ev.sort((a, b) => b.atMs - a.atMs).slice(0, 40);
}

export function demoState(nowMs) {
  const status = marketStatus(nowMs);
  const open = status === "khula";
  const dayMs = sessionDayMs(nowMs);
  const elapsed = minutesIntoSession(nowMs);
  const indices = {};
  const candleMap = {};
  const chain = {};
  const spots = {};
  for (const name of INDICES) {
    const dp = dayPath(name, dayMs);
    const ltp = liveSpot(name, dp, dayMs, elapsed, nowMs, open);
    spots[name] = ltp;
    candleMap[name] = candles(dp, dayMs, elapsed, r2(ltp));
    chain[name] = chainFor(name, dp, dayMs, elapsed, ltp);
    const cs = candleMap[name];
    indices[name] = {
      label: INDEX_META[name].label,
      ltp: r2(ltp),
      prevClose: r2(dp.prevClose),
      open: cs[0][1],
      high: Math.max(...cs.map((c) => c[2])),
      low: Math.min(...cs.map((c) => c[3])),
      change: r2(ltp - dp.prevClose),
      changePct: r2(((ltp - dp.prevClose) / dp.prevClose) * 100),
    };
  }
  const trades = tradesFor(dayMs, elapsed, spots);
  const entriesLeft = Math.max(0, MAX_ENTRIES - trades.entriesUsed);
  const signals = {};
  for (const name of INDICES) {
    signals[name] = signalFor(name, candleMap[name].map((c) => c[4]), chain[name], elapsed, entriesLeft);
    const s = signals[name];
    Object.assign(indices[name], {
      call: s.direction === "CALL" ? "SIGNAL" : "NA",
      put: s.direction === "PUT" ? "SIGNAL" : "NA",
      reason: s.reason,
      signal: s,
    });
  }
  const realised = r2(trades.book.reduce((a, t) => a + t.pnl, 0));
  const unrealised = r2(trades.positions.reduce((a, t) => a + t.pnl, 0));
  const charges = r2(trades.orders.filter((o) => o.status === "COMPLETE").length * CHARGE_PER_ORDER);
  const net = r2(realised + unrealised - charges);
  const used = r2(trades.positions.reduce((a, p) => a + p.value, 0));
  const openMs = dayMs + SESSION.openMin * 60000;
  const pnlCurve = [];
  const netAt = (m) => {
    const sp = {};
    for (const n of INDICES) sp[n] = spotAt(dayPath(n, dayMs), m);
    const tr = tradesFor(dayMs, m, sp);
    const done = tr.orders.filter((o) => o.status === "COMPLETE").length;
    return r2(tr.book.reduce((a, x) => a + x.pnl, 0) + tr.positions.reduce((a, x) => a + x.pnl, 0) - done * CHARGE_PER_ORDER);
  };
  // Beete minute badalte nahi: din ke hisaab se cache (har request par dobara na gino)
  const cached = curveCache.get(dayMs) || [];
  for (let m = cached.length * CANDLE_MIN; m < elapsed; m += CANDLE_MIN) cached.push([openMs + m * 60000, netAt(m)]);
  if (curveCache.size > 6) curveCache.clear();
  curveCache.set(dayMs, cached);
  for (const pt of cached) if (pt[0] < openMs + elapsed * 60000) pnlCurve.push(pt);
  pnlCurve.push([open ? nowMs : openMs + elapsed * 60000, net]);
  const vixR = rng(hash(`vix:${dayMs}`));
  const vixPrev = 11 + vixR() * 5;
  const vix = vixPrev * (1 + (vixR() - 0.5) * 0.08);
  const nifty = indices.Nifty50.changePct;
  const r = rng(hash(`health:${Math.floor(nowMs / 5000)}`));

  return {
    demo: true,
    generatedAtMs: nowMs,
    mode: "paper",
    running: open,
    milestone: "M1: bot abhi broker se juda nahi (yeh namoona hai)",
    mausam: Math.abs(nifty) > 0.6 ? (nifty > 0 ? "Trending (upar)" : "Trending (neeche)") : "Sideways",
    zone: open ? "Entry zone" : "Market band",
    entriesLeft,
    maxEntries: MAX_ENTRIES,
    dailyLossUsedPct: r2(Math.min(100, (Math.max(0, -(realised + unrealised)) / DEMO_LOSS_LIMIT) * 100)),
    profitLock: net >= DEMO_LOSS_LIMIT * 0.8,
    gates: ["Backtest Gate: baaki", "Paper Gate: baaki", "Stage2 Gate: baaki"],
    warning: "NAKLI DATA: bot abhi Dashboard ko haalat nahi bhej raha. Yeh sirf namoona hai.",
    market: {
      status,
      sessionDayMs: dayMs,
      session: SESSION.label,
      note: SESSION_NOTE,
      today: dayMs === istMidnightMs(nowMs),
      vix: { label: "India VIX", ltp: r2(vix), change: r2(vix - vixPrev), changePct: r2(((vix - vixPrev) / vixPrev) * 100) },
    },
    indices,
    candles: { tf: "5m", series: candleMap },
    chain,
    signals,
    pnl: { realised, unrealised, charges, net },
    pnlCurve,
    capital: { total: DEMO_CAPITAL, used, available: r2(DEMO_CAPITAL - used) },
    risk: {
      lossLimit: DEMO_LOSS_LIMIT,
      killLatch: false,
      brokerStop: trades.positions.length > 0,
    },
    positions: trades.positions,
    orders: trades.orders,
    tradeBook: trades.book,
    openTrades: trades.positions.map((p) => ({
      index: p.index, strike: p.strike, side: p.type, lots: p.lots, ltp: p.ltp, pnl: p.pnl, stopLoss: p.sl,
    })),
    health: {
      bot: { ok: true, text: open ? "Chalu (Paper)" : "Intezaar (market band)", heartbeatAgeMs: Math.round(300 + r() * 900) },
      pehredaar: { ok: true, text: "Lease valid (alag service)", renewAgeMs: Math.round(400 + r() * 1500) },
      feed: { ok: open, text: open ? "Juda" : "Band (market band)", lagMs: open ? Math.round(18 + r() * 60) : null },
      broker: { ok: true, text: "API theek", p50Ms: Math.round(14 + r() * 8), p95Ms: Math.round(35 + r() * 25) },
      token: { ok: true, text: "Valid", expiresAtMs: nextTokenExpiryMs(nowMs) },
      server: { ok: true, text: "Lightsail Mumbai (ek server)", cpuPct: Math.round(8 + r() * 20), ramPct: Math.round(35 + r() * 15) },
      staticIp: { ok: true, text: "Primary IP Upstox mein darj" },
    },
    events: eventsFor(dayMs, elapsed, trades, signals, status),
  };
}
