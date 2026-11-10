// Bot Terminal: har 5 second /api/state padhta hai (Dashboard_Push_Samay, idea v4).
// Suraksha: HTML string kabhi nahi banti. Har text textContent / text node se, har element createElement se.
"use strict";

const REFRESH_MS = 5000;
const STALE_S = 15;
const ORDER = ["Nifty50", "BankNifty", "Sensex"];
const VIEWS = ["home", "chart", "chain", "trades", "bot"];
const TITLES = { home: "Home", chart: "Chart", chain: "Option Chain", trades: "Trades", bot: "Bot" };
const SVGNS = "http://www.w3.org/2000/svg";
const MINUS = "−";

const $ = (id) => document.getElementById(id);
const ui = {
  view: "home",
  chartIdx: "Nifty50",
  tf: "5m",
  chainIdx: "Nifty50",
  tradeTab: "positions",
  data: null,
  lastAt: null,
  prevLtp: {},
  timer: null,
  inflight: false,
  chartW: 0,
};

/* ---------- chhote helpers ---------- */
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid instanceof Node ? kid : String(kid));
  return e;
}
function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  for (const kid of kids) if (kid) e.append(kid instanceof Node ? kid : String(kid));
  return e;
}
function icon(name, cls = "ic") {
  const s = svg("svg", { class: cls, "aria-hidden": "true", focusable: "false" });
  s.append(svg("use", { href: `#i-${name}` }));
  return s;
}
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const num = (v) => (fin(v) ? nf2.format(v) : "—");
const int = (v) => (fin(v) ? nf0.format(v) : "—");
const sign = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "");
const signed = (v) => (fin(v) ? sign(v) + nf2.format(Math.abs(v)) : "—");
const money = (v) => (fin(v) ? (v < 0 ? MINUS : "") + "₹" + nf2.format(Math.abs(v)) : "—");
const moneySigned = (v) => (fin(v) ? sign(v) + "₹" + nf2.format(Math.abs(v)) : "—");
const tone = (v) => (!fin(v) || v === 0 ? "flat" : v > 0 ? "up" : "down");
function compact(v) {
  if (!fin(v)) return "—";
  const a = Math.abs(v);
  const s = v < 0 ? MINUS : "";
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${a}`;
}
const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmtDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const hhmm = (ms) => (fin(ms) ? fmtTime.format(new Date(ms)) : "—");
function ago(ms) {
  if (!fin(ms)) return "—";
  return ms < 1000 ? `${ms} ms pehle` : `${(ms / 1000).toFixed(1)} s pehle`;
}
function arrowIcon(t) {
  return icon(t === "up" ? "up" : t === "down" ? "down" : "flat");
}
function chg(change, pct) {
  const t = tone(change);
  return el("span", { class: `chg chg-${t}` }, arrowIcon(t), `${signed(change)} (${signed(pct)}%)`);
}
function empty(text) {
  return el("div", { class: "empty" }, icon("empty"), el("p", { text }));
}

/* ---------- pasand yaad rakhna (sirf is browser mein) ---------- */
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem("bt-prefs") || "{}");
    if (ORDER.includes(p.chartIdx)) ui.chartIdx = p.chartIdx;
    if (ORDER.includes(p.chainIdx)) ui.chainIdx = p.chainIdx;
    if (p.tf === "5m" || p.tf === "15m") ui.tf = p.tf;
  } catch {
    /* storage band ho toh default */
  }
}
function savePrefs() {
  try {
    localStorage.setItem("bt-prefs", JSON.stringify({ chartIdx: ui.chartIdx, chainIdx: ui.chainIdx, tf: ui.tf }));
  } catch {
    /* koi baat nahi */
  }
}

/* ---------- theme ---------- */
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function paintThemeButton() {
  const t = currentTheme();
  const btn = $("theme-btn");
  btn.replaceChildren(icon(t === "dark" ? "sun" : "moon"));
  btn.setAttribute("aria-label", t === "dark" ? "Light theme chalu karo" : "Dark theme chalu karo");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#0b0f1a" : "#ffffff");
}
function initTheme() {
  try {
    const saved = localStorage.getItem("bt-theme");
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch {
    /* default */
  }
  paintThemeButton();
  $("theme-btn").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("bt-theme", next);
    } catch {
      /* koi baat nahi */
    }
    paintThemeButton();
    if (ui.data) renderView();
  });
}

/* ---------- routing (#home, #chart, ...) ---------- */
function route() {
  const v = location.hash.slice(1);
  if (VIEWS.includes(v)) ui.view = v;
  else if (!v) ui.view = "home";
  for (const s of document.querySelectorAll("[data-view]")) s.hidden = s.dataset.view !== ui.view;
  for (const a of document.querySelectorAll("[data-nav]")) {
    if (a.dataset.nav === ui.view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = `${TITLES[ui.view]} · Bot Terminal`;
  if (ui.data) renderView();
}

function seg(box, items, current, onPick, label) {
  box.setAttribute("role", "tablist");
  box.setAttribute("aria-label", label);
  box.replaceChildren(
    ...items.map(([val, text, count]) =>
      el(
        "button",
        { type: "button", role: "tab", class: "seg-btn", "aria-selected": String(val === current), onclick: () => onPick(val) },
        text,
        count === undefined ? null : el("span", { class: "count", text: String(count) }),
      ),
    ),
  );
}

/* ---------- top bar ---------- */
const MARKET_TEXT = { khula: "Market khula", "pre-open": "Pre-open", band: "Market band" };
function renderTop(d) {
  $("demo").hidden = !d.demo;
  const st = d.market?.status || "band";
  const chip = $("market-chip");
  chip.className = `chip ${st === "khula" ? "chip-open" : st === "pre-open" ? "chip-pre" : ""}`;
  chip.replaceChildren(el("span", { class: "dot" }), el("span", { text: MARKET_TEXT[st] || "Market" }));
  const mode = $("mode-chip");
  mode.textContent = d.mode === "real" ? "REAL MONEY" : "Paper";
  mode.className = `chip ${d.mode === "real" ? "chip-real" : "chip-accent"}`;
  const ticks = ORDER.filter((n) => d.indices?.[n]).map((n) => {
    const v = d.indices[n];
    const t = tone(v.change);
    return el("span", { class: "tick" }, el("b", { text: v.label || n }), num(v.ltp), el("span", { class: `tone-${t}`, text: `${signed(v.changePct)}%` }));
  });
  $("ticker").replaceChildren(...ticks);
}

/* ---------- HOME ---------- */
function sparkline(values, ref) {
  const w = 120;
  const h = 40;
  const box = svg("svg", { class: "spark", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  if (values.length < 2) return box;
  const all = fin(ref) ? [...values, ref] : values;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const slots = Math.max(values.length, 75);
  const x = (i) => (i / (slots - 1)) * w;
  const y = (v) => h - 3 - ((v - lo) / span) * (h - 6);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  const t = tone(values[last] - (fin(ref) ? ref : values[0]));
  box.setAttribute("class", `spark ${t}`);
  if (fin(ref)) box.append(svg("path", { class: "base", d: `M0,${y(ref).toFixed(1)}H${w}` }));
  box.append(svg("path", { class: "area", d: `${line}L${x(last).toFixed(1)},${h}L0,${h}Z` }));
  box.append(svg("path", { class: "line", d: line }));
  return box;
}
function rangeBar(low, high, ltp) {
  const pct = fin(low) && fin(high) && high > low ? ((ltp - low) / (high - low)) * 100 : 50;
  const i = el("i");
  i.style.setProperty("--pos", `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`);
  return el("div", { class: "range", "aria-label": `Din ka range ${num(low)} se ${num(high)}` }, el("span", { text: `L ${num(low)}` }), el("div", { class: "range-bar" }, i), el("span", { text: `H ${num(high)}` }));
}
function idxCard(name, v, closes) {
  const prev = ui.prevLtp[name];
  const flash = fin(prev) && prev !== v.ltp ? (v.ltp > prev ? " flash-up" : " flash-down") : "";
  ui.prevLtp[name] = v.ltp;
  return el(
    "a",
    {
      class: "idx-card",
      href: "#chart",
      "aria-label": `${v.label}: ${num(v.ltp)}, badlaav ${signed(v.change)}. Chart kholo`,
      onclick: () => {
        ui.chartIdx = name;
        savePrefs();
      },
    },
    el("div", { class: "idx-top" }, el("span", { class: "idx-name", text: v.label || name }), chg(v.change, v.changePct)),
    el("div", { class: `idx-ltp${flash}`, text: num(v.ltp) }),
    sparkline(closes, v.prevClose),
    rangeBar(v.low, v.high, v.ltp),
  );
}
function vixCard(v) {
  return el(
    "div",
    { class: "idx-card" },
    el("div", { class: "idx-top" }, el("span", { class: "idx-name", text: v.label || "India VIX" }), chg(v.change, v.changePct)),
    el("div", { class: "idx-ltp", text: num(v.ltp) }),
    el("p", { class: "muted small", text: "Dar ka meter. Zyada VIX = premium mehenga, bot sambhal kar." }),
  );
}
function meter(label, right, pct, cls) {
  const i = el("i");
  i.style.setProperty("--w", `${Math.max(0, Math.min(100, pct || 0)).toFixed(1)}%`);
  return el("div", { class: "meter" }, el("div", { class: "meter-top" }, el("span", { text: label }), el("span", { text: right })), el("div", { class: `bar ${cls || ""}`, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(pct || 0)), "aria-label": label }, i));
}
function renderPnl(d) {
  const p = d.pnl || {};
  const cap = d.capital || {};
  const used = fin(d.maxEntries) && fin(d.entriesLeft) ? d.maxEntries - d.entriesLeft : null;
  const kv = (k, v, cls) => el("div", {}, el("dt", { text: k }), el("dd", { class: cls || "", text: v }));
  $("pnl-sub").textContent = d.mode === "real" ? "Real Money" : "Paper trading";
  $("pnl").replaceChildren(
    el("div", { class: `pnl-net tone-${tone(p.net)}`, text: moneySigned(p.net) }),
    el("dl", { class: "kv" }, kv("Realised", moneySigned(p.realised), `tone-${tone(p.realised)}`), kv("Unrealised", moneySigned(p.unrealised), `tone-${tone(p.unrealised)}`), kv("Kharcha (andaza)", money(p.charges)), kv("Trades", used === null ? "—" : `${used} / ${d.maxEntries}`)),
    fin(cap.total) ? meter("Capital laga hua", `${money(cap.used)} / ${money(cap.total)}`, (cap.used / cap.total) * 100) : null,
  );
}
function positionCard(p) {
  const t = tone(p.pnl);
  const pct = fin(p.sl) && fin(p.target) && p.target > p.sl ? ((p.ltp - p.sl) / (p.target - p.sl)) * 100 : 50;
  const dot = el("i");
  dot.style.setProperty("--pos", `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`);
  const chgPct = fin(p.avg) && p.avg ? ((p.ltp - p.avg) / p.avg) * 100 : null;
  return el(
    "div",
    { class: "pos" },
    el(
      "div",
      { class: "pos-top" },
      el("div", {}, el("div", { class: "pos-sym" }, p.symbol || "—", el("span", { class: `tag tag-${String(p.type).toLowerCase()}`, text: p.type || "" })), el("div", { class: "pos-sub", text: `${p.lots ?? 1} lot · Avg ${num(p.avg)} · LTP ${num(p.ltp)} · ${hhmm(p.entryAtMs)} se` })),
      el("div", { class: `pos-pnl tone-${t}` }, moneySigned(p.pnl), el("small", { text: chgPct === null ? "" : `${signed(chgPct)}%` })),
    ),
    el("div", { class: "slt" }, el("div", { class: "slt-labels" }, el("span", { text: `SL ${num(p.sl)}` }), el("span", { text: `Target ${num(p.target)}` })), el("div", { class: "slt-bar", role: "img", "aria-label": `LTP stop-loss aur target ke beech ${Math.round(pct)}% par` }, dot)),
  );
}
function renderRisk(d) {
  const r = d.risk || {};
  const lossPct = d.dailyLossUsedPct;
  const lossCls = !fin(lossPct) ? "" : lossPct >= 80 ? "bad" : lossPct >= 50 ? "warn" : "good";
  const dots = el("div", { class: "dots", "aria-label": `${d.entriesLeft ?? "—"} entry bachi` });
  for (let i = 0; i < (d.maxEntries || 0); i++) dots.append(el("i", { class: i < d.maxEntries - d.entriesLeft ? "on" : "" }));
  $("risk").replaceChildren(
    el("div", { class: "risk-row" }, meter("Aaj ka nuksan (seema ka %)", fin(lossPct) ? `${num(lossPct)}% · seema ${money(r.lossLimit)}` : "Tay nahi", lossPct, lossCls)),
    el("div", { class: "risk-row" }, el("div", { class: "meter-top" }, el("span", { text: "Entry istemaal" }), el("span", { text: fin(d.entriesLeft) ? `${d.entriesLeft} bachi` : "—" })), dots),
    el(
      "div",
      { class: "flags" },
      el("span", { class: `flag ${d.profitLock ? "good" : ""}` }, icon("lock"), d.profitLock ? "Profit Lock laga" : "Profit Lock nahi"),
      el("span", { class: `flag ${r.killLatch ? "bad" : "good"}` }, icon(r.killLatch ? "alert" : "check"), r.killLatch ? "Kill Latch CHALU" : "Kill Latch band"),
      r.brokerStop
        ? el("span", { class: "flag good" }, icon("check"), "Broker Stop laga")
        : (d.positions || []).length
          ? el("span", { class: "flag bad" }, icon("x"), "Broker Stop NAHI laga")
          : el("span", { class: "flag" }, icon("flat"), "Broker Stop: koi position nahi"),
      el("span", { class: "flag" }, icon("clock"), d.zone || "—"),
      el("span", { class: "flag" }, `Mausam: ${d.mausam || "—"}`),
    ),
  );
}
function checkList(checks) {
  return el(
    "ul",
    { class: "checks" },
    ...(checks || []).map((c) => {
      const cls = c.ok === true ? "ok-yes" : c.ok === false ? "ok-no" : "ok-na";
      const word = c.ok === true ? "pass" : c.ok === false ? "fail" : "lagoo nahi";
      return el("li", {}, el("span", { class: cls, "aria-label": word }, icon(c.ok === true ? "check" : c.ok === false ? "x" : "flat")), el("span", { text: c.name }), el("span", { class: "note", text: c.note || "" }));
    }),
  );
}
function dirTag(dir) {
  const d = dir || "WAIT";
  return el("span", { class: `tag tag-${d.toLowerCase()}`, text: d === "CALL" ? "CALL khareedo" : d === "PUT" ? "PUT khareedo" : "WAIT" });
}
function signalBlock(name, label, s, open) {
  const i = el("i");
  i.style.setProperty("--w", `${s.score || 0}%`);
  const det = el(
    "details",
    { class: "sig" },
    el(
      "summary",
      {},
      el("span", { class: "sig-name" }, label),
      dirTag(s.direction),
      el("div", { class: "sig-score" }, el("div", { class: `bar ${s.score >= 70 ? "good" : s.score >= 50 ? "warn" : ""}` }, i), el("span", { text: `Score ${s.score ?? "—"}/100` })),
      el("span", { class: "sig-reason", text: s.reason || "" }),
    ),
    checkList(s.checks),
  );
  if (open) det.open = true;
  det.dataset.name = name;
  return det;
}
function renderSignals(d) {
  const box = $("signals");
  const opened = new Set([...box.querySelectorAll("details[open]")].map((x) => x.dataset.name));
  const list = ORDER.filter((n) => d.signals?.[n]).map((n) => signalBlock(n, d.indices?.[n]?.label || n, d.signals[n], opened.has(n)));
  box.replaceChildren(...(list.length ? list : [empty("Bot se signal abhi nahi aaye")]));
}
function renderEvents(d) {
  const items = (d.events || []).map((e) =>
    el("li", {}, el("time", { text: hhmm(e.atMs) }), el("span", { class: `pin ${e.level || "info"}`, "aria-hidden": "true" }), el("span", { text: e.text })),
  );
  $("events").replaceChildren(...(items.length ? items : [el("li", {}, empty("Abhi koi khabar nahi"))]));
}
function renderHome(d) {
  const series = d.candles?.series || {};
  const cards = ORDER.filter((n) => d.indices?.[n]).map((n) => idxCard(n, d.indices[n], (series[n] || []).map((c) => c[4])));
  if (d.market?.vix) cards.push(vixCard(d.market.vix));
  $("idx-cards").replaceChildren(...cards);
  const day = d.market?.sessionDayMs;
  $("session-line").textContent = fin(day) ? `Session: ${fmtDay.format(new Date(day))}${d.market.today ? "" : " (pichhla market din)"} · ${d.market.session || ""}` : "";
  renderPnl(d);
  const pos = d.positions || [];
  $("home-positions").replaceChildren(...(pos.length ? pos.map(positionCard) : [empty("Abhi koi khula position nahi. Bot achhe mauke ka intezaar kar raha hai.")]));
  renderSignals(d);
  renderRisk(d);
  renderEvents(d);
}

/* ---------- CHART ---------- */
function aggregate(cs, n) {
  const out = [];
  for (let i = 0; i < cs.length; i += n) {
    const g = cs.slice(i, i + n);
    out.push([g[0][0], g[0][1], Math.max(...g.map((c) => c[2])), Math.min(...g.map((c) => c[3])), g[g.length - 1][4]]);
  }
  return out;
}
function emaSeries(values, n) {
  const k = 2 / (n + 1);
  const out = [];
  let e = values[0];
  for (const v of values) {
    e = v * k + e * (1 - k);
    out.push(e);
  }
  return out;
}
function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
function setOhlc(c, label, prevClose) {
  if (!c) {
    $("ohlc").replaceChildren(el("span", { text: "Candle nahi" }));
    return;
  }
  const ch = c[4] - (fin(prevClose) ? prevClose : c[1]);
  const part = (k, v) => el("span", {}, k, el("b", { text: num(v) }));
  $("ohlc").replaceChildren(
    el("span", { class: "t", text: `${label} · ${hhmm(c[0])}` }),
    part("O", c[1]),
    part("H", c[2]),
    part("L", c[3]),
    part("C", c[4]),
    el("span", { class: `tone-${tone(ch)}`, text: `${signed(ch)} din mein` }),
  );
}
function drawChart(d) {
  const box = $("chart");
  const name = ui.chartIdx;
  const info = d.indices?.[name] || {};
  const raw = d.candles?.series?.[name] || [];
  const tfN = ui.tf === "15m" ? 3 : 1;
  const cs = tfN > 1 ? aggregate(raw, tfN) : raw;
  const W = Math.max(300, Math.round(box.clientWidth || 600));
  ui.chartW = W;
  const H = W < 560 ? 300 : 380;
  const pad = { l: 6, r: 62, t: 12, b: 24 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `${info.label || name} ${ui.tf} candles. Abhi ${num(info.ltp)}, din ka badlaav ${signed(info.change)}.` });
  if (!cs.length) {
    box.replaceChildren(empty("Is index ki candles abhi nahi aayi"));
    setOhlc(null);
    return;
  }
  const closes = cs.map((c) => c[4]);
  const e9 = emaSeries(closes, 9);
  const e21 = emaSeries(closes, 21);
  let lo = Math.min(...cs.map((c) => c[3]), ...e9, ...e21);
  let hi = Math.max(...cs.map((c) => c[2]), ...e9, ...e21);
  if (fin(info.prevClose)) {
    lo = Math.min(lo, info.prevClose);
    hi = Math.max(hi, info.prevClose);
  }
  const padV = (hi - lo) * 0.06 || 1;
  lo -= padV;
  hi += padV;
  const slots = tfN > 1 ? 25 : 75;
  const slot = pw / slots;
  const x = (i) => pad.l + (i + 0.5) * slot;
  const y = (v) => pad.t + ((hi - v) / (hi - lo)) * ph;
  const tfMs = 5 * 60000 * tfN;
  const t0 = cs[0][0];

  for (const v of niceTicks(lo, hi, 5)) {
    root.append(svg("line", { class: "grid", x1: pad.l, x2: pad.l + pw, y1: y(v).toFixed(1), y2: y(v).toFixed(1) }));
    root.append(svg("text", { class: "axis", x: W - pad.r + 6, y: (y(v) + 4).toFixed(1) }, nf0.format(v)));
  }
  for (let i = 0; i < slots; i++) {
    const t = t0 + i * tfMs;
    const label = hhmm(t);
    if (label.endsWith(":00") || (tfN === 1 && i === 0)) {
      root.append(svg("line", { class: "grid", x1: x(i).toFixed(1), x2: x(i).toFixed(1), y1: pad.t, y2: pad.t + ph, opacity: "0.5" }));
      root.append(svg("text", { class: "axis", x: x(i).toFixed(1), y: H - 6, "text-anchor": "middle" }, label));
    }
  }
  if (fin(info.prevClose)) root.append(svg("line", { class: "prev", x1: pad.l, x2: pad.l + pw, y1: y(info.prevClose).toFixed(1), y2: y(info.prevClose).toFixed(1) }));

  const bw = Math.max(1.5, Math.min(14, slot * 0.62));
  cs.forEach((c, i) => {
    const up = c[4] >= c[1];
    const cls = up ? "c-up" : "c-down";
    const cx = x(i);
    root.append(svg("line", { class: `wick ${cls}`, x1: cx.toFixed(1), x2: cx.toFixed(1), y1: y(c[2]).toFixed(1), y2: y(c[3]).toFixed(1) }));
    const top = y(Math.max(c[1], c[4]));
    const bh = Math.max(1, y(Math.min(c[1], c[4])) - top);
    root.append(svg("rect", { class: cls, x: (cx - bw / 2).toFixed(1), y: top.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: "1" }));
  });
  const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  root.append(svg("path", { class: "ema21", d: path(e21) }));
  root.append(svg("path", { class: "ema9", d: path(e9) }));

  // Bot ke entry / exit nishaan
  const idxOf = (ms) => Math.floor((ms - t0) / tfMs);
  const marks = [];
  for (const p of d.positions || []) if (p.index === name) marks.push({ at: p.entryAtMs, buy: true });
  for (const b of d.tradeBook || []) {
    if (b.index ? b.index !== name : !String(b.symbol || "").startsWith(info.label || "\u0000")) continue;
    marks.push({ at: b.entryAtMs, buy: true }, { at: b.exitAtMs, buy: false });
  }
  for (const m of marks) {
    const i = idxOf(m.at);
    if (i < 0 || i >= cs.length) continue;
    const cx = x(i);
    const s = 6;
    if (m.buy) {
      const yy = y(cs[i][3]) + 6;
      root.append(svg("path", { class: "m-buy", d: `M${cx},${yy} l${s},${s * 1.6} h${-2 * s} z` }));
    } else {
      const yy = y(cs[i][2]) - 6;
      root.append(svg("path", { class: "m-sell", d: `M${cx},${yy} l${s},${-s * 1.6} h${-2 * s} z` }));
    }
  }

  // Abhi ka daam
  const last = cs[cs.length - 1];
  const lt = tone(last[4] - last[1]) === "down" ? "down" : "up";
  const ly = y(last[4]);
  root.append(svg("line", { class: `last-line tag-${lt}`, x1: pad.l, x2: pad.l + pw, y1: ly.toFixed(1), y2: ly.toFixed(1) }));
  root.append(svg("rect", { class: `tag-${lt}`, x: W - pad.r + 1, y: (ly - 10).toFixed(1), width: pad.r - 3, height: 20, rx: 4 }));
  root.append(svg("text", { class: "last-tag", x: W - pad.r + 6, y: (ly + 4).toFixed(1) }, nf2.format(last[4])));

  // Crosshair (mouse / ungli)
  const vx = svg("line", { class: "xh", y1: pad.t, y2: pad.t + ph, visibility: "hidden" });
  const hy = svg("line", { class: "xh", x1: pad.l, x2: pad.l + pw, visibility: "hidden" });
  const hit = svg("rect", { class: "hit", x: pad.l, y: pad.t, width: pw, height: ph });
  root.append(vx, hy, hit);
  const label = `${info.label || name} ${ui.tf}`;
  const show = (ev) => {
    const r = root.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    const sy = ((ev.clientY - r.top) / r.height) * H;
    const i = Math.max(0, Math.min(cs.length - 1, Math.floor((sx - pad.l) / slot)));
    vx.setAttribute("x1", x(i).toFixed(1));
    vx.setAttribute("x2", x(i).toFixed(1));
    hy.setAttribute("y1", Math.max(pad.t, Math.min(pad.t + ph, sy)).toFixed(1));
    hy.setAttribute("y2", Math.max(pad.t, Math.min(pad.t + ph, sy)).toFixed(1));
    vx.setAttribute("visibility", "visible");
    hy.setAttribute("visibility", "visible");
    setOhlc(cs[i], label, info.prevClose);
  };
  const hide = () => {
    vx.setAttribute("visibility", "hidden");
    hy.setAttribute("visibility", "hidden");
    setOhlc(last, label, info.prevClose);
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", hide);
  box.replaceChildren(root);
  setOhlc(last, label, info.prevClose);
}
function signalDetail(d) {
  const s = d.signals?.[ui.chartIdx];
  if (!s) return empty("Signal abhi nahi");
  const i = el("i");
  i.style.setProperty("--w", `${s.score || 0}%`);
  return el(
    "div",
    {},
    el("div", { class: "card-head" }, dirTag(s.direction), el("span", { class: "muted small", text: s.reason || "" })),
    el("div", { class: "sig-score" }, el("div", { class: `bar ${s.score >= 70 ? "good" : s.score >= 50 ? "warn" : ""}` }, i), el("span", { text: `Score ${s.score}/100` })),
    checkList(s.checks),
  );
}
function renderChart(d) {
  seg($("chart-idx"), ORDER.filter((n) => d.indices?.[n]).map((n) => [n, d.indices[n].label || n]), ui.chartIdx, (v) => {
    ui.chartIdx = v;
    savePrefs();
    renderChart(ui.data);
  }, "Index chuno");
  seg($("chart-tf"), [["5m", "5 min"], ["15m", "15 min"]], ui.tf, (v) => {
    ui.tf = v;
    savePrefs();
    renderChart(ui.data);
  }, "Candle ka samay");
  drawChart(d);
  $("chart-signal").replaceChildren(signalDetail(d));
}

/* ---------- OPTION CHAIN ---------- */
function stat(label, value, cls) {
  return el("div", { class: "stat" }, el("span", { text: label }), el("b", { class: cls || "", text: value }));
}
function oiCell(side, oi, max) {
  const i = el("i");
  i.style.setProperty("--w", `${max ? ((oi / max) * 100).toFixed(1) : 0}%`);
  return el("td", { class: `oi ${side}` }, i, el("span", { text: compact(oi) }));
}
function ltpCell(o, extra) {
  return el("td", { class: `ltp ${extra}` }, num(o.ltp), el("small", { class: `tone-${tone(o.chg)}`, text: signed(o.chg) }));
}
function renderChain(d) {
  seg($("chain-idx"), ORDER.filter((n) => d.chain?.[n]).map((n) => [n, d.indices?.[n]?.label || n]), ui.chainIdx, (v) => {
    ui.chainIdx = v;
    savePrefs();
    renderChain(ui.data);
  }, "Index chuno");
  const c = d.chain?.[ui.chainIdx];
  const body = $("chain-body");
  if (!c) {
    $("chain-stats").replaceChildren();
    body.replaceChildren(el("tr", {}, el("td", { colspan: "9" }, empty("Option chain abhi nahi aayi"))));
    return;
  }
  const pcrNote = c.pcr > 1.2 ? "puts zyada (support)" : c.pcr < 0.8 ? "calls zyada (resistance)" : "santulit";
  $("chain-stats").replaceChildren(stat("Spot", num(c.spot)), stat("ATM strike", int(c.atm)), stat(`PCR · ${pcrNote}`, num(c.pcr)), stat("Max Pain", int(c.maxPain)));
  const max = Math.max(...c.rows.flatMap((r) => [r.ce.oi, r.pe.oi]));
  const rows = [];
  let spotDone = false;
  for (const r of c.rows) {
    if (!spotDone && r.strike > c.spot) {
      rows.push(el("tr", { class: "spot" }, el("td", { colspan: "9" }, el("div", { class: "spot-line" }, el("span", { text: `Spot ${num(c.spot)}` })))));
      spotDone = true;
    }
    const ceItm = r.strike < c.spot ? "itm" : "";
    const peItm = r.strike > c.spot ? "itm" : "";
    const tr = el(
      "tr",
      { class: r.strike === c.atm ? "atm" : "" },
      oiCell(`ce ${ceItm}`, r.ce.oi, max),
      el("td", { class: `hide-sm tone-${tone(r.ce.oiChg)} ${ceItm}`, text: compact(r.ce.oiChg) }),
      el("td", { class: `hide-sm ${ceItm}`, text: num(r.ce.iv) }),
      ltpCell(r.ce, ceItm),
      el("td", { class: "strike", text: int(r.strike) }),
      ltpCell(r.pe, peItm),
      el("td", { class: `hide-sm ${peItm}`, text: num(r.pe.iv) }),
      el("td", { class: `hide-sm tone-${tone(r.pe.oiChg)} ${peItm}`, text: compact(r.pe.oiChg) }),
      oiCell(`pe ${peItm}`, r.pe.oi, max),
    );
    rows.push(tr);
  }
  body.replaceChildren(...rows);
}

/* ---------- TRADES ---------- */
const STATUS_CLS = { COMPLETE: "st-complete", "TRIGGER PENDING": "st-pending", OPEN: "st-pending", CANCELLED: "st-cancelled", REJECTED: "st-rejected" };
function orderRow(o) {
  return el(
    "div",
    { class: "row-item" },
    el("div", {}, el("div", { class: "pos-sym" }, el("span", { class: `tag tag-${String(o.side).toLowerCase()}`, text: o.side }), o.symbol), el("div", { class: "sub", text: `${hhmm(o.atMs)} · ${o.kind} · ${o.lots ?? 1} lot` })),
    el("div", { class: "r" }, el("div", { text: num(o.price) }), el("span", { class: `status ${STATUS_CLS[o.status] || "st-cancelled"}`, text: o.status })),
  );
}
function bookRow(b) {
  return el(
    "div",
    { class: "row-item" },
    el("div", {}, el("div", { class: "pos-sym", text: b.symbol }), el("div", { class: "sub", text: `${hhmm(b.entryAtMs)} → ${hhmm(b.exitAtMs)} · ${num(b.avg)} → ${num(b.exit)} · ${b.reason || ""}` })),
    el("div", { class: `r pos-pnl tone-${tone(b.pnl)}`, text: moneySigned(b.pnl) }),
  );
}
function renderTrades(d) {
  const p = d.pnl || {};
  const pos = d.positions || [];
  const orders = d.orders || [];
  const book = d.tradeBook || [];
  $("trade-stats").replaceChildren(stat("Net P&L (kharche ke baad)", moneySigned(p.net), `tone-${tone(p.net)}`), stat("Realised", moneySigned(p.realised), `tone-${tone(p.realised)}`), stat("Unrealised", moneySigned(p.unrealised), `tone-${tone(p.unrealised)}`), stat("Kharcha (andaza)", money(p.charges)));
  seg($("trade-tabs"), [["positions", "Positions", pos.length], ["orders", "Orders", orders.length], ["book", "Trade book", book.length]], ui.tradeTab, (v) => {
    ui.tradeTab = v;
    renderTrades(ui.data);
  }, "Trades ke hisse");
  let list;
  if (ui.tradeTab === "orders") list = orders.length ? orders.map(orderRow) : [empty("Aaj koi order nahi")];
  else if (ui.tradeTab === "book") list = book.length ? book.map(bookRow) : [empty("Aaj koi trade band nahi hua")];
  else list = pos.length ? pos.map(positionCard) : [empty("Koi khula position nahi")];
  $("trade-list").replaceChildren(...list);
}

/* ---------- BOT ---------- */
function countdown(ms) {
  if (!fin(ms)) return "—";
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m baad`;
}
function renderBot(d) {
  const h = d.health || {};
  const tiles = [
    ["bot", "Bot process", (x) => `heartbeat ${ago(x.heartbeatAgeMs)}`],
    ["pehredaar", "Pehredaar", (x) => `lease renew ${ago(x.renewAgeMs)}`],
    ["feed", "Live feed", (x) => (fin(x.lagMs) ? `der ${x.lagMs} ms` : "market band")],
    ["broker", "Broker API", (x) => `p50 ${x.p50Ms} ms · p95 ${x.p95Ms} ms`],
    ["token", "Login token", (x) => `khatam: ${hhmm(x.expiresAtMs)} IST (${countdown(x.expiresAtMs)})`],
    ["server", "Server", (x) => `CPU ${x.cpuPct}% · RAM ${x.ramPct}%`],
    ["staticIp", "Static IP", () => "IP badalna sirf market band hone par"],
  ];
  $("health").replaceChildren(
    ...tiles
      .filter(([k]) => h[k])
      .map(([k, label, sub]) => {
        const x = h[k];
        return el("div", { class: "health" }, el("div", { class: "health-top" }, el("span", { text: label }), el("span", { class: `state ${x.ok ? "ok" : "bad"}` }, el("i"), x.ok ? "Theek" : "Dhyan do")), el("b", { text: x.text || "—" }), el("span", { class: "sub", text: sub(x) }));
      }),
  );
  if (!Object.keys(h).length) $("health").replaceChildren(empty("Bot se sehat ki khabar abhi nahi"));
  $("gates").replaceChildren(...(d.gates || []).map((g) => el("li", {}, icon("clock"), g)));
  $("session-note").textContent = d.market ? `Maana gaya samay: ${d.market.session}. Dhyan: ${d.market.note}.` : "—";
}

/* ---------- sab jodna ---------- */
function renderView() {
  const d = ui.data;
  if (!d) return;
  if (ui.view === "home") renderHome(d);
  else if (ui.view === "chart") renderChart(d);
  else if (ui.view === "chain") renderChain(d);
  else if (ui.view === "trades") renderTrades(d);
  else if (ui.view === "bot") renderBot(d);
}
async function refresh() {
  if (ui.inflight) return;
  ui.inflight = true;
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    ui.data = d;
    ui.lastAt = d.generatedAtMs;
    renderTop(d);
    renderView();
    $("error").hidden = true;
  } catch (e) {
    const box = $("error");
    box.hidden = false;
    box.replaceChildren(icon("alert"), el("span", { text: `Data nahi mila (${e.message}). Purana data dikh raha hai; agle refresh par phir koshish.` }));
  } finally {
    ui.inflight = false;
  }
}
function start() {
  stop();
  refresh();
  ui.timer = setInterval(refresh, REFRESH_MS);
}
function stop() {
  if (ui.timer) clearInterval(ui.timer);
  ui.timer = null;
}
function tickClock() {
  $("clock").textContent = `${fmtClock.format(new Date())} IST`;
  if (ui.lastAt === null) return;
  const sec = Math.max(0, Math.round((Date.now() - ui.lastAt) / 1000));
  const age = $("age");
  age.textContent = `Data ki umar: ${sec} s`;
  age.classList.toggle("stale", sec > STALE_S);
}

loadPrefs();
initTheme();
route();
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    if (ui.view === "chart" && ui.data && Math.abs(($("chart").clientWidth || 0) - ui.chartW) > 8) drawChart(ui.data);
  }).observe($("chart"));
}
start();
tickClock();
setInterval(tickClock, 1000);
