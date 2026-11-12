// Bot Terminal: routing, header, auto-refresh, notifications. Har 5 s (ya pasand ke hisaab se) /api/state.
import { $, clock, el, hhmm, icon, num, openSheet, signed, store, toast } from "./dom.js";
import { setRerender, ui } from "./state.js";
import { initActivity, initControls, renderActivity, renderControls, renderHealth, renderSetup, tickHealth } from "./views/bot.js";
import { renderChain } from "./views/chain.js";
import { initChart, leaveChart, renderChart } from "./views/chart.js";
import { initOverview, renderOverview } from "./views/overview.js";
import { initSettings, renderSettings } from "./views/settings.js";
import { initTrades, renderTrades } from "./views/trades.js";

const VIEWS = {
  home: ["Overview", renderOverview],
  chart: ["Chart", renderChart],
  chain: ["Option Chain", renderChain],
  trades: ["Trades", renderTrades],
  health: ["Bot ki sehat", renderHealth],
  controls: ["Controls", renderControls],
  activity: ["Activity log", renderActivity],
  settings: ["Settings", renderSettings],
  setup: ["Setup checklist", renderSetup],
};
const ALIAS = { bot: "health" };
const NEEDS_DATA = new Set(["home", "chart", "chain", "trades", "health", "activity"]);
const MARKET_TEXT = { khula: ["Market khula", "Khula"], "pre-open": ["Pre-open", "Pre-open"], band: ["Market band", "Band"] };
let timer = null;

/* ---------- render ---------- */
function render() {
  const [, fn] = VIEWS[ui.view];
  if (NEEDS_DATA.has(ui.view) && !ui.data) return;
  try {
    fn(ui.data || {});
  } catch (e) {
    console.error(e);
    toast("Is page ko dikhane mein dikkat aayi", "bad");
  }
}
setRerender(render);

function route() {
  const raw = location.hash.slice(1);
  const v = ALIAS[raw] || raw;
  const prev = ui.view;
  if (VIEWS[v]) ui.view = v;
  else if (!raw) ui.view = "home";
  if (prev === "chart" && ui.view !== "chart") leaveChart();
  for (const s of document.querySelectorAll("[data-view]")) s.hidden = s.dataset.view !== ui.view;
  for (const a of document.querySelectorAll("[data-nav]")) {
    const on = a.dataset.nav === ui.view || (a.dataset.nav === "more" && !["home", "chart", "chain", "trades"].includes(ui.view));
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = `${VIEWS[ui.view][0]} · Bot Terminal`;
  if (prev !== ui.view) window.scrollTo({ top: 0 });
  render();
}

/* ---------- header ---------- */
function renderTop(d) {
  $("demo").hidden = !d.demo;
  const st = d.market?.status || "band";
  const chip = $("market-chip");
  chip.className = `chip ${st === "khula" ? "chip-open" : st === "pre-open" ? "chip-pre" : ""}`;
  const [long, short] = MARKET_TEXT[st] || ["Market", "Market"];
  chip.replaceChildren(el("span", { class: "dot" }), el("span", { class: "mk-long", text: long }), el("span", { class: "mk-short", text: short }));
  const mode = $("mode-chip");
  // Bot juda nahi (demo) toh Controls mein chuna gaya practice mode dikhao, warna bot ka asli mode.
  const chosen = d.demo ? store.get("bt-practice", {}).mode || "paper" : d.mode;
  const real = chosen === "real";
  mode.textContent = real ? (d.demo ? "Real (practice)" : "REAL MONEY") : d.demo ? "Paper (practice)" : "Paper";
  mode.className = `chip ${real ? "chip-real" : "chip-accent"}`;
  $("ticker").replaceChildren(
    ...["Nifty50", "BankNifty", "Sensex"]
      .filter((n) => d.indices?.[n])
      .map((n) => {
        const v = d.indices[n];
        const t = v.change > 0 ? "up" : v.change < 0 ? "down" : "flat";
        return el("a", { class: "tick", href: "#chart", onclick: () => (ui.chart.idx = n) }, el("span", { class: "tick-name", text: v.label || n }), el("span", { class: "tick-ltp", text: num(v.ltp) }), el("span", { class: `tone-${t}`, text: `${signed(v.changePct)}%` }));
      }),
  );
  renderBell(d);
}

function unread(d) {
  const seen = store.get("bt-seen", 0);
  return (d.events || []).filter((e) => e.atMs > seen);
}

function renderBell(d) {
  const n = unread(d).length;
  const badge = $("bell-badge");
  badge.hidden = n === 0;
  badge.textContent = n > 9 ? "9+" : String(n);
  $("bell-btn").setAttribute("aria-label", n ? `Notifications: ${n} nayi` : "Notifications: koi nayi nahi");
}

function openBell() {
  const d = ui.data || {};
  const fresh = new Set(unread(d));
  const list = (d.events || []).slice(0, 12);
  const markAll = el("button", { type: "button", class: "btn btn-secondary" }, icon("check"), el("span", { text: "Sab padh liya" }));
  const all = el("a", { class: "btn btn-ghost", href: "#activity" }, icon("list"), el("span", { text: "Poora log" }));
  const sheet = openSheet({
    title: "Notifications",
    body: list.length
      ? el("ol", { class: "timeline" }, ...list.map((e) => el("li", { class: fresh.has(e) ? "is-new" : "" }, el("time", { text: hhmm(e.atMs) }), el("span", { class: `pin ${e.level || "info"}`, "aria-hidden": "true" }), el("span", { class: "ev-text", text: e.text }), fresh.has(e) ? el("span", { class: "new-tag", text: "Nayi" }) : null)))
      : el("p", { class: "muted", text: "Abhi koi khabar nahi" }),
    footer: el("div", { class: "row-end" }, all, markAll),
  });
  const mark = () => {
    const top = Math.max(0, ...(d.events || []).map((e) => e.atMs));
    store.set("bt-seen", top);
    renderBell(d);
  };
  markAll.addEventListener("click", () => {
    mark();
    sheet.close();
    toast("Sab notifications padh liye", "good");
  });
  all.addEventListener("click", () => sheet.close());
}

function openMore() {
  const links = [
    ["health", "Bot ki sehat", "bot"],
    ["controls", "Controls", "power"],
    ["activity", "Activity log", "list"],
    ["settings", "Settings", "settings"],
    ["setup", "Setup checklist", "check"],
  ];
  const sheet = openSheet({
    title: "Aur",
    side: "bottom",
    body: el(
      "nav",
      { class: "more-list", "aria-label": "Aur pages" },
      ...links.map(([k, label, ic]) => el("a", { href: `#${k}`, class: ui.view === k ? "on" : "", "aria-current": ui.view === k ? "page" : null }, icon(ic), el("span", { text: label }), icon("chevron", "ic ic-sm muted"))),
    ),
  });
  for (const a of sheet.dialog.querySelectorAll("a")) a.addEventListener("click", () => sheet.close());
}

/* ---------- theme ---------- */
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.dataset.theme = mode;
  else delete root.dataset.theme;
  store.set("bt-theme", mode);
  const dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "dark";
  const btn = $("theme-btn");
  btn.replaceChildren(icon(dark ? "sun" : "moon"));
  btn.setAttribute("aria-label", dark ? "Light theme chalu karo" : "Dark theme chalu karo");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0f1a" : "#ffffff");
  if (ui.data) render();
}

/* ---------- data ---------- */
function setLoading(on) {
  ui.loading = on;
  $("refresh-btn").classList.toggle("spin", on);
  document.body.classList.toggle("is-loading", on);
}

async function refresh(manual = false) {
  if (ui.loading) return;
  setLoading(true);
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    ui.data = d;
    ui.lastAt = d.generatedAtMs;
    renderTop(d);
    render();
    $("error").hidden = true;
    if (manual) toast("Data taaza ho gaya", "good");
  } catch (e) {
    const box = $("error");
    box.hidden = false;
    box.replaceChildren(icon("alert"), el("span", { text: `Data nahi mila (${e.message}). Purana data dikh raha hai; agle refresh par phir koshish.` }));
  } finally {
    setLoading(false);
  }
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function start() {
  stop();
  if (!ui.prefs.live || document.hidden) return;
  timer = setInterval(refresh, ui.prefs.refreshS * 1000);
}
function paintLive() {
  const b = $("live-btn");
  b.setAttribute("aria-pressed", String(ui.prefs.live));
  b.classList.toggle("is-live", ui.prefs.live);
  b.replaceChildren(el("span", { class: "dot" }), el("span", { class: "live-word", text: ui.prefs.live ? "Live" : "Ruka" }));
  b.setAttribute("aria-label", ui.prefs.live ? `Auto-refresh chalu (har ${ui.prefs.refreshS} s). Rokne ke liye dabao` : "Auto-refresh ruka hai. Chalu karne ke liye dabao");
}

function tick() {
  $("clock").textContent = `${clock(Date.now())} IST`;
  tickHealth();
  if (ui.lastAt === null) return;
  const sec = Math.max(0, Math.round((Date.now() - ui.lastAt) / 1000));
  const age = $("age");
  const stale = sec > Math.max(15, ui.prefs.refreshS * 3);
  age.textContent = ui.prefs.live ? `Data ${sec} s purana` : `Auto-refresh ruka · data ${sec} s purana`;
  age.classList.toggle("stale", stale && ui.prefs.live);
}

/* ---------- shuru ---------- */
function boot() {
  applyTheme(store.get("bt-theme", "system"));
  $("theme-btn").addEventListener("click", () => {
    const dark = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "dark";
    applyTheme(dark ? "light" : "dark");
  });
  window.addEventListener("bt-theme", (e) => applyTheme(e.detail));
  window.addEventListener("bt-top", () => ui.data && renderTop(ui.data));
  window.addEventListener("bt-restart", () => {
    paintLive();
    start();
  });
  $("refresh-btn").addEventListener("click", () => refresh(true));
  $("live-btn").addEventListener("click", () => {
    ui.prefs.live = !ui.prefs.live;
    store.set("bt-prefs", { ...store.get("bt-prefs", {}), live: ui.prefs.live });
    paintLive();
    start();
    toast(ui.prefs.live ? `Auto-refresh chalu (har ${ui.prefs.refreshS} s)` : "Auto-refresh ruka. ⟳ se haath se taaza karo.", "info");
    if (ui.prefs.live) refresh();
  });
  $("bell-btn").addEventListener("click", openBell);
  $("more-btn").addEventListener("click", openMore);
  initOverview();
  initChart();
  initTrades();
  initControls();
  initActivity();
  initSettings();
  paintLive();
  route();
  window.addEventListener("hashchange", route);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else {
      refresh();
      start();
    }
  });
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - lastW) <= 8) return;
    lastW = window.innerWidth;
    if (["home", "chart"].includes(ui.view)) render();
  });
  refresh();
  start();
  tick();
  setInterval(tick, 1000);
}

boot();
