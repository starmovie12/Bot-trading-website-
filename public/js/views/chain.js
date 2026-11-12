// Option chain: index + strike range chuno; row par click/Enter se strike ki poori jaankari.
import { $, compact, el, empty, int, num, openSheet, seg, signed, stat, tone } from "../dom.js";
import { ORDER, refreshView, savePrefs, ui } from "../state.js";

function oiCell(side, oi, max, itm) {
  const bar = el("i");
  bar.style.setProperty("--w", `${max ? ((oi / max) * 100).toFixed(1) : 0}%`);
  return el("td", { class: `oi ${side} ${itm}` }, bar, el("span", { text: compact(oi) }));
}

function ltpCell(o, itm) {
  return el("td", { class: `ltp ${itm}` }, el("span", { class: "ltp-v", text: num(o.ltp) }), el("small", { class: `tone-${tone(o.chg)}`, text: signed(o.chg) }));
}

function detail(name, label, c, r) {
  const side = (title, o, itm, cls) =>
    el(
      "section",
      { class: `opt-side ${cls}` },
      el("div", { class: "opt-head" }, el("span", { class: `tag tag-${cls}`, text: title }), el("span", { class: "muted small", text: itm ? "In-the-money" : "Out-of-the-money" })),
      el("div", { class: "opt-ltp" }, el("b", { text: num(o.ltp) }), el("span", { class: `tone-${tone(o.chg)}`, text: `${signed(o.chg)} aaj` })),
      el(
        "dl",
        { class: "kv" },
        el("div", {}, el("dt", { text: "Open Interest" }), el("dd", { text: compact(o.oi) })),
        el("div", {}, el("dt", { text: "OI badlaav" }), el("dd", { class: `tone-${tone(o.oiChg)}`, text: compact(o.oiChg) })),
        el("div", {}, el("dt", { text: "IV" }), el("dd", { text: `${num(o.iv)}%` })),
        el("div", {}, el("dt", { text: "Spot se doori" }), el("dd", { text: `${signed(r.strike - c.spot)} pts` })),
      ),
    );
  openSheet({
    title: `${label} ${int(r.strike)}`,
    body: el(
      "div",
      { class: "opt-detail" },
      el("p", { class: "muted small", text: `Spot ${num(c.spot)} · ${c.expiry} · Bot sirf 1 lot leta hai, achha premium ho tabhi.` }),
      side("CALL (CE)", r.ce, r.strike < c.spot, "ce"),
      side("PUT (PE)", r.pe, r.strike > c.spot, "pe"),
    ),
  });
}

export function renderChain(d) {
  const st = ui.chain;
  seg($("cn-idx"), ORDER.filter((n) => d.chain?.[n]).map((n) => [n, d.indices?.[n]?.label || n]), st.idx, (v) => {
    st.idx = v;
    savePrefs();
    refreshView();
  }, "Index chuno");
  seg($("cn-span"), [[5, "±5 strike"], [7, "±7 strike"]], st.span, (v) => {
    st.span = v;
    savePrefs();
    refreshView();
  }, "Kitne strike");
  const c = d.chain?.[st.idx];
  const label = d.indices?.[st.idx]?.label || st.idx;
  const body = $("cn-body");
  if (!c) {
    $("cn-stats").replaceChildren();
    body.replaceChildren(el("tr", {}, el("td", { colspan: "9" }, empty("Option chain abhi nahi aayi"))));
    return;
  }
  const rows = c.rows.filter((r) => Math.abs(r.strike - c.atm) <= st.span * c.step);
  const maxCe = c.rows.reduce((a, r) => (r.ce.oi > a.ce.oi ? r : a));
  const maxPe = c.rows.reduce((a, r) => (r.pe.oi > a.pe.oi ? r : a));
  const pcrNote = c.pcr > 1.2 ? "puts zyada" : c.pcr < 0.8 ? "calls zyada" : "santulit";
  $("cn-stats").replaceChildren(
    stat("Spot", num(c.spot), "", c.expiry),
    stat("PCR", num(c.pcr), "", pcrNote),
    stat("Max Pain", int(c.maxPain), "", "expiry par sabse kam nuksan"),
    stat("Resistance", int(maxCe.strike), "", `sabse zyada Call OI`),
    stat("Support", int(maxPe.strike), "", `sabse zyada Put OI`),
  );
  const max = Math.max(...rows.flatMap((r) => [r.ce.oi, r.pe.oi]));
  const out = [];
  let spotDone = false;
  for (const r of rows) {
    if (!spotDone && r.strike > c.spot) {
      out.push(el("tr", { class: "spot", "aria-hidden": "true" }, el("td", { colspan: "9" }, el("div", { class: "spot-line" }, el("span", { text: `Spot ${num(c.spot)}` })))));
      spotDone = true;
    }
    const ceItm = r.strike < c.spot ? "itm" : "";
    const peItm = r.strike > c.spot ? "itm" : "";
    const tr = el(
      "tr",
      {
        class: `row-btn${r.strike === c.atm ? " atm" : ""}`,
        tabindex: "0",
        "aria-label": `${int(r.strike)} strike: call ${num(r.ce.ltp)}, put ${num(r.pe.ltp)}. Detail kholo`,
        onclick: () => detail(st.idx, label, c, r),
        onkeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            detail(st.idx, label, c, r);
          }
        },
      },
      oiCell("ce", r.ce.oi, max, ceItm),
      el("td", { class: `hide-sm ${ceItm} tone-${tone(r.ce.oiChg)}`, text: compact(r.ce.oiChg) }),
      el("td", { class: `hide-sm ${ceItm}`, text: num(r.ce.iv) }),
      ltpCell(r.ce, ceItm),
      el("td", { class: "strike" }, el("span", { text: int(r.strike) }), r.strike === c.atm ? el("small", { text: "ATM" }) : null),
      ltpCell(r.pe, peItm),
      el("td", { class: `hide-sm ${peItm}`, text: num(r.pe.iv) }),
      el("td", { class: `hide-sm ${peItm} tone-${tone(r.pe.oiChg)}`, text: compact(r.pe.oiChg) }),
      oiCell("pe", r.pe.oi, max, peItm),
    );
    out.push(tr);
  }
  body.replaceChildren(...out);
}
