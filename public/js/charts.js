// SVG charts (koi library nahi). Dataviz niyam: 2px lines, solid hairline grid, area ~10%,
// crosshair + tooltip (values pehle), keyboard se bhi (←/→), text kabhi data ke rang mein nahi.
import { el, fin, hhmm, num, signed, moneySigned, svg, tone } from "./dom.js";

const SESSION_MS = 375 * 60000;

function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function emaSeries(values, n) {
  const k = 2 / (n + 1);
  const out = [];
  let e = values[0];
  for (const v of values) {
    e = v * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

export function aggregate(cs, n) {
  if (n <= 1) return cs;
  const out = [];
  for (let i = 0; i < cs.length; i += n) {
    const g = cs.slice(i, i + n);
    out.push([g[0][0], g[0][1], Math.max(...g.map((c) => c[2])), Math.min(...g.map((c) => c[3])), g[g.length - 1][4]]);
  }
  return out;
}

const axisFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Tooltip + keyboard: dono chart yahi use karte hain.
function interactive(box, root, { count, xAt, plot, show, hide }) {
  const tip = el("div", { class: "tip", role: "status", "aria-live": "polite", hidden: true });
  const vline = svg("line", { class: "xh", y1: plot.t, y2: plot.t + plot.h, visibility: "hidden" });
  const hit = svg("rect", { class: "hit", x: plot.l, y: plot.t, width: plot.w, height: plot.h });
  root.append(vline, hit);
  let cur = null;
  const place = (i, px) => {
    cur = i;
    box.dataset.cur = String(i);
    const x = xAt(i);
    vline.setAttribute("x1", x.toFixed(1));
    vline.setAttribute("x2", x.toFixed(1));
    vline.setAttribute("visibility", "visible");
    show(i, tip);
    tip.hidden = false;
    const W = root.viewBox.baseVal.width;
    const scale = root.getBoundingClientRect().width / W || 1;
    const left = (px ?? x) * scale;
    const tw = tip.offsetWidth || 140;
    const boxW = box.clientWidth;
    tip.style.setProperty("--tx", `${Math.max(4, Math.min(boxW - tw - 4, left + 14 > boxW - tw ? left - tw - 14 : left + 14))}px`);
  };
  const off = () => {
    cur = null;
    delete box.dataset.cur;
    vline.setAttribute("visibility", "hidden");
    tip.hidden = true;
    hide();
  };
  const fromEvent = (ev) => {
    const r = root.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * root.viewBox.baseVal.width;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(xAt(i) - sx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    place(best, xAt(best));
  };
  hit.addEventListener("pointermove", fromEvent);
  hit.addEventListener("pointerdown", fromEvent);
  // Touch par ungli uthate hi "pointerleave" aata hai; tab tooltip rehne do (agla tap use hilayega).
  hit.addEventListener("pointerleave", (e) => e.pointerType !== "touch" && off());
  box.tabIndex = 0;
  box.onkeydown = (e) => {
    if (!count) return;
    let i = cur ?? count - 1;
    if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "ArrowRight") i = Math.min(count - 1, i + 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = count - 1;
    else if (e.key === "Escape") return off();
    else return;
    e.preventDefault();
    place(i);
  };
  box.onblur = off;
  // Refresh ke baad pichhli jagah par tooltip wapas (5 s mein gayab na ho)
  const restore = () => {
    const prev = Number(box.dataset.cur);
    if (box.dataset.cur !== undefined && Number.isInteger(prev)) place(Math.min(prev, count - 1));
  };
  return { tip, restore };
}

/* ---------- Candlestick ---------- */
export function drawCandles(box, { candles, tfN, prevClose, label, show9, show21, showMarks, markers, onFocusCandle }) {
  const W = Math.max(300, Math.round(box.clientWidth || 640));
  const H = box.dataset.max === "1" ? Math.max(320, Math.round(window.innerHeight - 220)) : W < 560 ? 300 : 400;
  const plot = { l: 8, t: 14, w: W - 8 - 66, h: H - 14 - 28 };
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  const cs = candles;
  if (!cs.length) {
    box.replaceChildren(el("div", { class: "empty" }, el("p", { text: "Candles abhi nahi aayi" })));
    return;
  }
  const closes = cs.map((c) => c[4]);
  const e9 = emaSeries(closes, 9);
  const e21 = emaSeries(closes, 21);
  const vals = [...cs.map((c) => c[2]), ...cs.map((c) => c[3])];
  if (show9) vals.push(...e9);
  if (show21) vals.push(...e21);
  if (fin(prevClose)) vals.push(prevClose);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const slots = tfN > 1 ? 25 : 75;
  const slot = plot.w / slots;
  const x = (i) => plot.l + (i + 0.5) * slot;
  const y = (v) => plot.t + ((hi - v) / (hi - lo)) * plot.h;
  const tfMs = 5 * 60000 * tfN;
  const t0 = cs[0][0];
  const last = cs[cs.length - 1];
  root.setAttribute("aria-label", `${label} candles. Abhi ${num(last[4])}. Teer (← →) se candle chuno.`);

  for (const v of niceTicks(lo, hi, 5)) {
    root.append(svg("line", { class: "grid", x1: plot.l, x2: plot.l + plot.w, y1: y(v).toFixed(1), y2: y(v).toFixed(1) }));
    root.append(svg("text", { class: "axis", x: plot.l + plot.w + 8, y: (y(v) + 4).toFixed(1) }, axisFmt.format(v)));
  }
  for (let i = 0; i < slots; i++) {
    const lab = hhmm(t0 + i * tfMs);
    if (lab.endsWith(":00") || i === 0) root.append(svg("text", { class: "axis", x: x(i).toFixed(1), y: H - 8, "text-anchor": i === 0 ? "start" : "middle" }, lab));
  }
  if (fin(prevClose)) root.append(svg("line", { class: "prev", x1: plot.l, x2: plot.l + plot.w, y1: y(prevClose).toFixed(1), y2: y(prevClose).toFixed(1) }));

  const bw = Math.max(1.5, Math.min(12, slot * 0.6));
  cs.forEach((c, i) => {
    const cls = c[4] >= c[1] ? "c-up" : "c-down";
    const cx = x(i);
    root.append(svg("line", { class: `wick ${cls}`, x1: cx.toFixed(1), x2: cx.toFixed(1), y1: y(c[2]).toFixed(1), y2: y(c[3]).toFixed(1) }));
    const top = y(Math.max(c[1], c[4]));
    root.append(svg("rect", { class: cls, x: (cx - bw / 2).toFixed(1), y: top.toFixed(1), width: bw.toFixed(1), height: Math.max(1, y(Math.min(c[1], c[4])) - top).toFixed(1), rx: 1 }));
  });
  const path = (v) => v.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join("");
  if (show21) root.append(svg("path", { class: "ema21", d: path(e21) }));
  if (show9) root.append(svg("path", { class: "ema9", d: path(e9) }));

  if (showMarks) {
    for (const m of markers) {
      const i = Math.floor((m.at - t0) / tfMs);
      if (i < 0 || i >= cs.length) continue;
      const cx = x(i);
      const s = 6;
      if (m.buy) root.append(svg("path", { class: "m-buy", d: `M${cx},${(y(cs[i][3]) + 6).toFixed(1)} l${s},${s * 1.6} h${-2 * s} z` }));
      else root.append(svg("path", { class: "m-sell", d: `M${cx},${(y(cs[i][2]) - 6).toFixed(1)} l${s},${-s * 1.6} h${-2 * s} z` }));
    }
  }

  const lt = last[4] >= last[1] ? "up" : "down";
  const ly = y(last[4]);
  root.append(svg("line", { class: `last-line stroke-${lt}`, x1: plot.l, x2: plot.l + plot.w, y1: ly.toFixed(1), y2: ly.toFixed(1) }));
  root.append(svg("rect", { class: `fill-${lt}`, x: plot.l + plot.w + 2, y: (ly - 10).toFixed(1), width: 62, height: 20, rx: 4 }));
  root.append(svg("text", { class: "last-tag", x: plot.l + plot.w + 8, y: (ly + 4).toFixed(1) }, num(last[4])));

  box.replaceChildren(root);
  const { tip, restore } = interactive(box, root, {
    count: cs.length,
    xAt: x,
    plot: { l: plot.l, t: plot.t, w: plot.w, h: plot.h },
    show: (i, t) => {
      const c = cs[i];
      t.replaceChildren(
        el("strong", { text: num(c[4]) }),
        el("span", { class: `tone-${tone(c[4] - c[1])}`, text: `${signed(c[4] - c[1])} is candle mein` }),
        el("span", { text: `O ${num(c[1])} · H ${num(c[2])} · L ${num(c[3])}` }),
        el("span", { class: "tip-time", text: `${label} · ${hhmm(c[0])}` }),
      );
      onFocusCandle(c);
    },
    hide: () => onFocusCandle(last),
  });
  box.append(tip);
  onFocusCandle(last);
  restore();
}

/* ---------- P&L line (ek series: legend ki zaroorat nahi, title hi naam hai) ---------- */
export function drawPnl(box, { points, t0 }) {
  const W = Math.max(280, Math.round(box.clientWidth || 600));
  const H = W < 560 ? 170 : 190;
  const plot = { l: 8, t: 12, w: W - 8 - 64, h: H - 12 - 26 };
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
  if (!points.length) {
    box.replaceChildren(el("div", { class: "empty" }, el("p", { text: "Aaj abhi koi P&L nahi" })));
    return;
  }
  const vals = points.map((p) => p[1]);
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.12 || 100;
  lo -= pad;
  hi += pad;
  const x = (t) => plot.l + Math.max(0, Math.min(1, (t - t0) / SESSION_MS)) * plot.w;
  const y = (v) => plot.t + ((hi - v) / (hi - lo)) * plot.h;
  const lastV = vals[vals.length - 1];
  const t = tone(lastV) === "down" ? "down" : "up";
  root.setAttribute("aria-label", `Aaj ka P&L din bhar: abhi ${moneySigned(lastV)}. Teer (← →) se samay chuno.`);
  for (const v of niceTicks(lo, hi, 4)) {
    root.append(svg("line", { class: v === 0 ? "grid zero" : "grid", x1: plot.l, x2: plot.l + plot.w, y1: y(v).toFixed(1), y2: y(v).toFixed(1) }));
    root.append(svg("text", { class: "axis", x: plot.l + plot.w + 8, y: (y(v) + 4).toFixed(1) }, `${v < 0 ? "−" : ""}₹${axisFmt.format(Math.abs(v))}`));
  }
  for (const h of [10, 11, 12, 13, 14, 15]) {
    const tm = t0 + ((h * 60 - (9 * 60 + 15)) * 60000);
    root.append(svg("text", { class: "axis", x: x(tm).toFixed(1), y: H - 8, "text-anchor": "middle" }, `${h}:00`));
  }
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const lastX = x(points[points.length - 1][0]);
  root.append(svg("path", { class: `area fill-${t}`, d: `${line}L${lastX.toFixed(1)},${y(0).toFixed(1)}L${x(points[0][0]).toFixed(1)},${y(0).toFixed(1)}Z` }));
  root.append(svg("path", { class: `line stroke-${t}`, d: line }));
  root.append(svg("circle", { class: `dot fill-${t}`, cx: lastX.toFixed(1), cy: y(lastV).toFixed(1), r: 4 }));
  box.replaceChildren(root);
  const { tip, restore } = interactive(box, root, {
    count: points.length,
    xAt: (i) => x(points[i][0]),
    plot,
    show: (i, tp) => tp.replaceChildren(el("strong", { text: moneySigned(points[i][1]) }), el("span", { class: "tip-time", text: `${hhmm(points[i][0])} IST tak` })),
    hide: () => {},
  });
  box.append(tip);
  restore();
}
