// Poore terminal ki ek jagah haalat + browser mein yaad rakhi pasand.
import { store } from "./dom.js";

export const ORDER = ["Nifty50", "BankNifty", "Sensex"];
export const REFRESH_CHOICES = [5, 10, 30];

const saved = store.get("bt-prefs", {});
const pick = (v, ok, d) => (ok(v) ? v : d);
const defIdx = pick(saved.defaultIdx, (v) => ORDER.includes(v), "Nifty50");

export const ui = {
  view: "home",
  data: null,
  lastAt: null,
  loading: false,
  prevLtp: {},
  prefs: {
    defaultIdx: defIdx,
    refreshS: pick(saved.refreshS, (v) => REFRESH_CHOICES.includes(v), 5),
    live: saved.live !== false,
  },
  chart: {
    idx: pick(saved.chartIdx, (v) => ORDER.includes(v), defIdx),
    tf: pick(saved.tf, (v) => v === "5m" || v === "15m", "5m"),
    ema9: saved.ema9 !== false,
    ema21: saved.ema21 !== false,
    marks: saved.marks !== false,
    table: false,
    max: false,
  },
  chain: { idx: pick(saved.chainIdx, (v) => ORDER.includes(v), defIdx), span: pick(saved.span, (v) => v === 5 || v === 7, 7) },
  trades: { tab: "positions" },
  activity: { level: "all", q: "" },
  pnlTable: false,
};

export function savePrefs() {
  store.set("bt-prefs", {
    ...ui.prefs,
    chartIdx: ui.chart.idx,
    tf: ui.chart.tf,
    ema9: ui.chart.ema9,
    ema21: ui.chart.ema21,
    marks: ui.chart.marks,
    chainIdx: ui.chain.idx,
    span: ui.chain.span,
  });
}

// Har view isse dobara bulata hai jab kuch badle (data ya button).
let rerender = () => {};
export const setRerender = (fn) => {
  rerender = fn;
};
export const refreshView = () => rerender();
