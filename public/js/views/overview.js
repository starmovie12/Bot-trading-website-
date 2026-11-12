// Home: market cards, aaj ka P&L (hero), P&L curve, positions, signals, risk, khabar.
import { drawPnl } from "../charts.js";
import { $, chg, dayLabel, el, empty, fin, hhmm, icon, meter, money, moneySigned, num, signed, svg, tone } from "../dom.js";
import { ORDER, refreshView, savePrefs, ui } from "../state.js";

function sparkline(values, ref) {
  const w = 120;
  const h = 36;
  const box = svg("svg", { class: "spark", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  if (values.length < 2) return box;
  const all = fin(ref) ? [...values, ref] : values;
  const lo = Math.min(...all);
  const span = Math.max(...all) - lo || 1;
  const slots = Math.max(values.length, 75);
  const x = (i) => (i / (slots - 1)) * w;
  const y = (v) => h - 3 - ((v - lo) / span) * (h - 6);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  box.setAttribute("class", `spark ${tone(values[last] - (fin(ref) ? ref : values[0]))}`);
  if (fin(ref)) box.append(svg("path", { class: "base", d: `M0,${y(ref).toFixed(1)}H${w}` }));
  box.append(svg("path", { class: "area", d: `${line}L${x(last).toFixed(1)},${h}L0,${h}Z` }));
  box.append(svg("path", { class: "line", d: line }));
  return box;
}

function rangeBar(low, high, ltp) {
  const pct = fin(low) && fin(high) && high > low ? ((ltp - low) / (high - low)) * 100 : 50;
  const dot = el("i");
  dot.style.setProperty("--pos", `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`);
  return el("div", { class: "range", role: "img", "aria-label": `Din ka range ${num(low)} se ${num(high)}` }, el("span", { text: `L ${num(low)}` }), el("div", { class: "range-bar" }, dot), el("span", { text: `H ${num(high)}` }));
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
      "aria-label": `${v.label}: ${num(v.ltp)}, aaj ${signed(v.change)}. Chart kholo`,
      onclick: () => {
        ui.chart.idx = name;
        savePrefs();
      },
    },
    el("div", { class: "idx-top" }, el("span", { class: "idx-name", text: v.label || name }), icon("chevron", "ic ic-sm muted")),
    el("div", { class: `idx-ltp${flash}`, text: num(v.ltp) }),
    chg(v.change, v.changePct),
    sparkline(closes, v.prevClose),
    rangeBar(v.low, v.high, v.ltp),
  );
}

function vixCard(v) {
  return el(
    "div",
    { class: "idx-card idx-static" },
    el("div", { class: "idx-top" }, el("span", { class: "idx-name", text: v.label || "India VIX" })),
    el("div", { class: "idx-ltp", text: num(v.ltp) }),
    chg(v.change, v.changePct),
    el("p", { class: "idx-note", text: "Dar ka meter. VIX zyada = premium mehenga; bot sambhal kar entry leta hai." }),
  );
}

export function positionCard(p) {
  const pct = fin(p.sl) && fin(p.target) && p.target > p.sl ? ((p.ltp - p.sl) / (p.target - p.sl)) * 100 : 50;
  const dot = el("i");
  dot.style.setProperty("--pos", `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`);
  const chPct = fin(p.avg) && p.avg ? ((p.ltp - p.avg) / p.avg) * 100 : null;
  return el(
    "article",
    { class: "pos" },
    el(
      "div",
      { class: "pos-top" },
      el("div", { class: "pos-main" }, el("div", { class: "pos-sym" }, el("span", { text: p.symbol || "—" }), el("span", { class: `tag tag-${String(p.type).toLowerCase()}`, text: p.type || "" })), el("div", { class: "pos-sub", text: `${p.lots ?? 1} lot · ${hhmm(p.entryAtMs)} se` })),
      el("div", { class: "pos-pnl" }, el("b", { class: `tone-${tone(p.pnl)}`, text: moneySigned(p.pnl) }), el("small", { class: `tone-${tone(p.pnl)}`, text: chPct === null ? "" : `${signed(chPct)}%` })),
    ),
    el("dl", { class: "pos-grid" }, el("div", {}, el("dt", { text: "Avg" }), el("dd", { text: num(p.avg) })), el("div", {}, el("dt", { text: "LTP" }), el("dd", { text: num(p.ltp) })), el("div", {}, el("dt", { text: "SL" }), el("dd", { text: num(p.sl) })), el("div", {}, el("dt", { text: "Target" }), el("dd", { text: num(p.target) }))),
    el("div", { class: "slt" }, el("div", { class: "slt-bar", role: "img", "aria-label": `LTP stop-loss aur target ke beech ${Math.round(pct)}% par` }, dot), el("div", { class: "slt-labels" }, el("span", { text: "Stop-Loss" }), el("span", { text: "Target" }))),
  );
}

export function checkList(checks) {
  return el(
    "ul",
    { class: "checks" },
    ...(checks || []).map((c) => {
      const cls = c.ok === true ? "ok-yes" : c.ok === false ? "ok-no" : "ok-na";
      return el("li", {}, el("span", { class: `check-ic ${cls}` }, icon(c.ok === true ? "check" : c.ok === false ? "x" : "flat")), el("span", { class: "check-name", text: c.name }), el("span", { class: "check-note", text: `${c.ok === true ? "Pass" : c.ok === false ? "Fail" : "Lagoo nahi"} · ${c.note || ""}` }));
    }),
  );
}

export function dirTag(dir) {
  const d = dir || "WAIT";
  return el("span", { class: `tag tag-${d.toLowerCase()}`, text: d === "CALL" ? "CALL khareedo" : d === "PUT" ? "PUT khareedo" : "WAIT" });
}

export function scoreBar(score) {
  const fill = el("i");
  fill.style.setProperty("--w", `${fin(score) ? score : 0}%`);
  return el("div", { class: "score" }, el("div", { class: `bar ${score >= 70 ? "good" : score >= 50 ? "warn" : ""}` }, fill), el("span", { class: "score-val", text: fin(score) ? `${score}/100` : "—" }));
}

function signals(d) {
  const box = $("ov-signals");
  const opened = new Set([...box.querySelectorAll("details[open]")].map((x) => x.dataset.name));
  const list = ORDER.filter((n) => d.signals?.[n]).map((n) => {
    const s = d.signals[n];
    const det = el(
      "details",
      { class: "sig", "data-name": n },
      el("summary", {}, el("div", { class: "sig-row" }, el("span", { class: "sig-name", text: d.indices?.[n]?.label || n }), dirTag(s.direction), icon("chevron", "ic ic-sm sig-chev")), scoreBar(s.score), el("p", { class: "sig-reason", text: s.reason || "" })),
      checkList(s.checks),
    );
    det.open = opened.has(n);
    return det;
  });
  box.replaceChildren(...(list.length ? list : [empty("Bot se signal abhi nahi aaye")]));
}

function risk(d) {
  const r = d.risk || {};
  const lossPct = d.dailyLossUsedPct;
  const lossCls = !fin(lossPct) ? "" : lossPct >= 80 ? "bad" : lossPct >= 50 ? "warn" : "good";
  const used = fin(d.maxEntries) && fin(d.entriesLeft) ? d.maxEntries - d.entriesLeft : 0;
  const dots = el("div", { class: "dots", role: "img", "aria-label": `${used} entry li, ${d.entriesLeft ?? "—"} bachi` });
  for (let i = 0; i < (d.maxEntries || 0); i++) dots.append(el("i", { class: i < used ? "on" : "" }));
  const flag = (cls, ic, text) => el("li", { class: `flag ${cls}` }, icon(ic), el("span", { text }));
  const pos = (d.positions || []).length;
  $("ov-risk").replaceChildren(
    meter("Aaj ka nuksan (seema ka %)", fin(lossPct) ? `${num(lossPct)}% · seema ${money(r.lossLimit)}` : "Tay nahi", lossPct, lossCls),
    el("div", { class: "meter" }, el("div", { class: "meter-top" }, el("span", { text: "Aaj ki entry" }), el("span", { class: "meter-val", text: fin(d.entriesLeft) ? `${used} li · ${d.entriesLeft} bachi` : "—" })), dots),
    el(
      "ul",
      { class: "flags" },
      d.profitLock ? flag("good", "lock", "Profit Lock laga") : flag("", "lock", "Profit Lock nahi"),
      r.killLatch ? flag("bad", "alert", "Kill Latch CHALU") : flag("good", "check", "Kill Latch band"),
      r.brokerStop ? flag("good", "check", "Broker Stop laga") : pos ? flag("bad", "x", "Broker Stop NAHI") : flag("", "flat", "Broker Stop: position nahi"),
      flag("", "clock", d.zone || "—"),
      flag("", "chart", `Mausam: ${d.mausam || "—"}`),
    ),
  );
}

function pnl(d) {
  const p = d.pnl || {};
  const cap = d.capital || {};
  const used = fin(d.maxEntries) && fin(d.entriesLeft) ? d.maxEntries - d.entriesLeft : null;
  $("ov-pnl-mode").textContent = d.mode === "real" ? "Real Money" : "Paper trading";
  $("ov-pnl-hero").textContent = moneySigned(p.net);
  $("ov-pnl-hero").className = `hero tone-${tone(p.net)}`;
  const kv = (k, v, cls = "") => el("div", {}, el("dt", { text: k }), el("dd", { class: cls, text: v }));
  $("ov-pnl-kv").replaceChildren(
    kv("Realised", moneySigned(p.realised), `tone-${tone(p.realised)}`),
    kv("Unrealised", moneySigned(p.unrealised), `tone-${tone(p.unrealised)}`),
    kv("Kharcha (andaza)", money(p.charges)),
    kv("Trades", used === null ? "—" : `${used} / ${d.maxEntries}`),
  );
  $("ov-capital").replaceChildren(fin(cap.total) ? meter("Capital laga hua", `${money(cap.used)} / ${money(cap.total)}`, (cap.used / cap.total) * 100) : el("span"));
  const pts = d.pnlCurve || [];
  const day = d.market?.sessionDayMs;
  const t0 = Number.isFinite(day) ? day + (9 * 60 + 15) * 60000 : pts[0]?.[0] ?? Date.now();
  const btn = $("ov-pnl-table");
  btn.setAttribute("aria-pressed", String(ui.pnlTable));
  btn.lastElementChild.textContent = ui.pnlTable ? "Chart dikhao" : "Table dikhao";
  if (ui.pnlTable) {
    $("ov-pnl-chart").replaceChildren(
      el(
        "div",
        { class: "table-wrap tall" },
        el("table", { class: "data" }, el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Samay (IST)" }), el("th", { scope: "col", text: "Net P&L" }))), el("tbody", {}, ...pts.slice().reverse().map((x) => el("tr", {}, el("td", { text: hhmm(x[0]) }), el("td", { class: `tone-${tone(x[1])}`, text: moneySigned(x[1]) }))))),
      ),
    );
  } else drawPnl($("ov-pnl-chart"), { points: pts, t0 });
}

function events(d) {
  const items = (d.events || []).slice(0, 7).map((e) => el("li", {}, el("time", { text: hhmm(e.atMs) }), el("span", { class: `pin ${e.level || "info"}`, "aria-hidden": "true" }), el("span", { class: "ev-text", text: e.text })));
  $("ov-events").replaceChildren(...(items.length ? items : [el("li", { class: "li-empty" }, empty("Abhi koi khabar nahi"))]));
}

export function initOverview() {
  $("ov-pnl-table").addEventListener("click", () => {
    ui.pnlTable = !ui.pnlTable;
    refreshView();
  });
}

export function renderOverview(d) {
  const series = d.candles?.series || {};
  const cards = ORDER.filter((n) => d.indices?.[n]).map((n) => idxCard(n, d.indices[n], (series[n] || []).map((c) => c[4])));
  if (d.market?.vix) cards.push(vixCard(d.market.vix));
  $("ov-cards").replaceChildren(...cards);
  const day = d.market?.sessionDayMs;
  $("ov-session").textContent = fin(day) ? `${dayLabel(day)}${d.market.today ? "" : " (pichhla market din)"} · ${d.market.session || ""}` : "";
  pnl(d);
  const pos = d.positions || [];
  $("ov-positions").replaceChildren(...(pos.length ? pos.map(positionCard) : [empty("Koi khula position nahi. Bot achhe premium ka intezaar kar raha hai.")]));
  signals(d);
  risk(d);
  events(d);
}
