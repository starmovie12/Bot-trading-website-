// Dashboard: har 5 second /api/state padhta hai (Dashboard_Push_Samay, idea v4). Text sirf textContent se lagta hai, HTML string kabhi nahi.
"use strict";

const REFRESH_MS = 5000;
const $ = (id) => document.getElementById(id);
let lastAt = null;

function text(id, value) {
  $(id).textContent = value === null || value === undefined ? "Tay nahi" : String(value);
}

function renderList(id, items) {
  const ul = $(id);
  ul.replaceChildren(
    ...(items.length ? items : ["Koi nahi"]).map((g) => {
      const li = document.createElement("li");
      li.textContent = g;
      return li;
    }),
  );
}

function badge(value) {
  const span = document.createElement("span");
  span.className = `badge badge-${String(value).toLowerCase()}`;
  span.textContent = value;
  return span;
}

function renderIndices(indices) {
  const box = $("indices");
  box.replaceChildren(
    ...Object.entries(indices).map(([name, v]) => {
      const card = document.createElement("div");
      card.className = "card";
      const h = document.createElement("h3");
      h.textContent = name;
      const row = document.createElement("p");
      row.append("Call ", badge(v.call), "  Put ", badge(v.put));
      const reason = document.createElement("p");
      reason.className = "muted";
      reason.textContent = v.reason || "";
      card.append(h, row, reason);
      return card;
    }),
  );
}

function renderTrades(trades) {
  const tb = $("trades");
  if (!trades.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "muted";
    td.textContent = "Koi khula trade nahi";
    tr.append(td);
    tb.replaceChildren(tr);
    return;
  }
  tb.replaceChildren(
    ...trades.map((t) => {
      const tr = document.createElement("tr");
      for (const k of ["index", "strike", "side", "lots", "ltp", "pnl", "stopLoss"]) {
        const td = document.createElement("td");
        td.textContent = t[k] ?? "—";
        tr.append(td);
      }
      return tr;
    }),
  );
}

function render(s) {
  $("demo").hidden = !s.demo;
  const pill = $("pill");
  pill.textContent = s.demo ? "Bot juda nahi" : s.running ? "Bot chalu" : "Bot band";
  pill.className = `pill ${s.running && !s.demo ? "pill-on" : "pill-off"}`;
  text("mode", s.mode === "real" ? "Real Money" : "Paper");
  text("running", s.running ? "Chalu" : "Band");
  text("mausam", s.mausam);
  text("zone", s.zone);
  text("entries", s.entriesLeft);
  text("loss", s.dailyLossUsedPct === null ? null : `${s.dailyLossUsedPct}%`);
  text("lock", s.profitLock ? "Laga hai" : "Nahi");
  renderList("gates", s.gates || []);
  text("warning", s.warning || "Koi nahi");
  renderIndices(s.indices || {});
  renderTrades(s.openTrades || []);
  lastAt = s.generatedAtMs;
}

async function refresh() {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    render(await r.json());
    $("error").hidden = true;
  } catch (e) {
    $("error").hidden = false;
    $("error").textContent = `Data nahi mila (${e.message}). Purana data dikh raha hai.`;
  }
}

function tickAge() {
  if (lastAt === null) return;
  const sec = Math.max(0, Math.round((Date.now() - lastAt) / 1000));
  $("age").textContent = `data ki umar: ${sec} s`;
  $("age").classList.toggle("stale", sec > 15);
}

refresh();
setInterval(refresh, REFRESH_MS);
setInterval(tickAge, 1000);
