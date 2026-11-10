// Chart: index + samay chuno, EMA/nishaan on-off, table view, bada screen.
import { aggregate, drawCandles } from "../charts.js";
import { $, el, empty, fin, hhmm, num, seg, signed, toggleChip, tone } from "../dom.js";
import { ORDER, refreshView, savePrefs, ui } from "../state.js";
import { checkList, dirTag, scoreBar } from "./overview.js";

function readout(c, label, prevClose) {
  const box = $("ch-ohlc");
  if (!c) return box.replaceChildren();
  const dayChg = fin(prevClose) ? c[4] - prevClose : null;
  const part = (k, v) => el("span", { class: "ohlc-part" }, el("span", { class: "muted", text: k }), el("b", { text: num(v) }));
  box.replaceChildren(
    el("span", { class: "ohlc-t", text: `${label} · ${hhmm(c[0])}` }),
    part("O", c[1]),
    part("H", c[2]),
    part("L", c[3]),
    part("C", c[4]),
    dayChg === null ? null : el("span", { class: `tone-${tone(dayChg)}`, text: `${signed(dayChg)} aaj` }),
  );
}

function markersFor(d, name) {
  const out = [];
  for (const p of d.positions || []) if (p.index === name) out.push({ at: p.entryAtMs, buy: true });
  for (const b of d.tradeBook || []) if (b.index === name) out.push({ at: b.entryAtMs, buy: true }, { at: b.exitAtMs, buy: false });
  return out;
}

function table(cs) {
  return el(
    "div",
    { class: "table-wrap tall" },
    el(
      "table",
      { class: "data" },
      el("caption", { class: "sr-only", text: "Har candle ka Open, High, Low, Close" }),
      el("thead", {}, el("tr", {}, ...["Samay", "Open", "High", "Low", "Close", "Badlaav"].map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, ...cs.slice().reverse().map((c) => el("tr", {}, el("td", { text: hhmm(c[0]) }), el("td", { text: num(c[1]) }), el("td", { text: num(c[2]) }), el("td", { text: num(c[3]) }), el("td", { text: num(c[4]) }), el("td", { class: `tone-${tone(c[4] - c[1])}`, text: signed(c[4] - c[1]) })))),
    ),
  );
}

function setMax(on, redraw = true) {
  ui.chart.max = on;
  const card = $("ch-card");
  card.classList.toggle("is-max", on);
  $("ch-plot").dataset.max = on ? "1" : "0";
  document.body.classList.toggle("no-scroll", on);
  const btn = $("ch-max");
  btn.setAttribute("aria-pressed", String(on));
  btn.lastElementChild.textContent = on ? "Chhota karo" : "Bada karo";
  if (redraw) refreshView();
}

export function initChart() {
  $("ch-max").addEventListener("click", () => setMax(!ui.chart.max));
  $("ch-table").addEventListener("click", () => {
    ui.chart.table = !ui.chart.table;
    refreshView();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ui.chart.max && !document.querySelector("dialog[open]")) setMax(false);
  });
}

export function leaveChart() {
  if (ui.chart.max) setMax(false, false); // route() khud render karta hai
}

export function renderChart(d) {
  const c = ui.chart;
  seg($("ch-idx"), ORDER.filter((n) => d.indices?.[n]).map((n) => [n, d.indices[n].label || n]), c.idx, (v) => {
    c.idx = v;
    savePrefs();
    refreshView();
  }, "Index chuno");
  seg($("ch-tf"), [["5m", "5 min"], ["15m", "15 min"]], c.tf, (v) => {
    c.tf = v;
    savePrefs();
    refreshView();
  }, "Candle ka samay");
  const flip = (k) => (on) => {
    c[k] = on;
    savePrefs();
    refreshView();
  };
  $("ch-toggles").replaceChildren(toggleChip("EMA 9", c.ema9, flip("ema9"), "key-ema9"), toggleChip("EMA 21", c.ema21, flip("ema21"), "key-ema21"), toggleChip("Entry/Exit", c.marks, flip("marks"), "key-mark"));
  const tb = $("ch-table");
  tb.setAttribute("aria-pressed", String(c.table));
  tb.lastElementChild.textContent = c.table ? "Chart dikhao" : "Table dikhao";

  const info = d.indices?.[c.idx] || {};
  const tfN = c.tf === "15m" ? 3 : 1;
  const cs = aggregate(d.candles?.series?.[c.idx] || [], tfN);
  const label = `${info.label || c.idx} ${c.tf}`;
  $("ch-title").textContent = info.label || c.idx;
  $("ch-ltp").textContent = num(info.ltp);
  $("ch-chg").className = `chg chg-${tone(info.change)}`;
  $("ch-chg").textContent = `${signed(info.change)} (${signed(info.changePct)}%)`;
  $("ch-legend").hidden = c.table;
  if (c.table) {
    $("ch-plot").replaceChildren(cs.length ? table(cs) : empty("Candles abhi nahi aayi"));
    $("ch-plot").removeAttribute("tabindex");
    readout(cs[cs.length - 1], label, info.prevClose);
  } else {
    drawCandles($("ch-plot"), {
      candles: cs,
      tfN,
      prevClose: info.prevClose,
      label,
      show9: c.ema9,
      show21: c.ema21,
      showMarks: c.marks,
      markers: markersFor(d, c.idx),
      onFocusCandle: (k) => readout(k, label, info.prevClose),
    });
  }
  const s = d.signals?.[c.idx];
  $("ch-signal").replaceChildren(
    s
      ? el("div", { class: "sig-detail" }, el("div", { class: "sig-row" }, dirTag(s.direction), el("span", { class: "muted small", text: s.reason || "" })), scoreBar(s.score), checkList(s.checks))
      : empty("Is index ka signal abhi nahi"),
  );
}
