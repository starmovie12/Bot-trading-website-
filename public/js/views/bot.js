// Bot ke admin pages: Sehat, Controls (practice), Activity log, Setup checklist.
import { $, istDate, ago, button, confirmDialog, downloadFile, el, empty, fin, fullTime, hhmm, icon, meter, seg, store, toCsv, toast } from "../dom.js";
import { refreshView, ui } from "../state.js";

/* ---------------- Sehat ---------------- */
export function countdown(ms) {
  if (!fin(ms)) return "—";
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}

const TILES = [
  ["bot", "Bot process", "bot", (x) => `Heartbeat ${ago(x.heartbeatAgeMs)}`],
  ["pehredaar", "Pehredaar", "shield", (x) => `Lease renew ${ago(x.renewAgeMs)}`],
  ["feed", "Live feed", "pulse", (x) => (fin(x.lagMs) ? `Der ${x.lagMs} ms` : "Market band")],
  ["broker", "Broker API", "link", (x) => `p50 ${x.p50Ms} ms · p95 ${x.p95Ms} ms`],
  ["token", "Login token", "key", (x) => `Khatam ${hhmm(x.expiresAtMs)} IST`],
  ["server", "Server", "server", (x) => `CPU ${x.cpuPct}% · RAM ${x.ramPct}%`],
  ["staticIp", "Static IP", "globe", () => "Badlo sirf market band par"],
];

export function renderHealth(d) {
  const h = d.health || {};
  const tiles = TILES.filter(([k]) => h[k]).map(([k, label, ic, sub]) => {
    const x = h[k];
    return el(
      "article",
      { class: "health" },
      el("div", { class: "health-top" }, el("span", { class: "health-ic" }, icon(ic)), el("span", { class: "health-label", text: label }), el("span", { class: `state ${x.ok ? "ok" : "bad"}` }, el("i"), x.ok ? "Theek" : "Dhyan do")),
      el("b", { class: "health-val", text: x.text || "—" }),
      el("span", { class: "health-sub", text: sub(x) }),
      k === "token" ? el("span", { class: "health-count", "data-expires": String(x.expiresAtMs), text: countdown(x.expiresAtMs) }) : null,
    );
  });
  $("hl-tiles").replaceChildren(...(tiles.length ? tiles : [empty("Bot se sehat ki khabar abhi nahi")]));
  $("hl-gates").replaceChildren(...(d.gates || []).map((g) => el("li", {}, icon("clock"), el("span", { text: g }))));
  $("hl-session").textContent = d.market ? `Maana gaya samay: ${d.market.session}. Dhyan: ${d.market.note}.` : "—";
}

export function tickHealth() {
  for (const n of document.querySelectorAll(".health-count[data-expires]")) n.textContent = countdown(Number(n.dataset.expires));
}

/* ---------------- Controls (PRACTICE: bot juda nahi, hukm broker tak nahi jaata) ---------------- */
const PKEY = "bt-practice";
const practice = () => ({ power: "on", mode: "paper", paused: false, kill: false, log: [], ...store.get(PKEY, {}) });

function save(p, label, kind = "good") {
  p.log = [{ at: Date.now(), text: label }, ...(p.log || [])].slice(0, 40);
  store.set(PKEY, p);
  window.dispatchEvent(new Event("bt-top")); // header ka mode chip turant badle
  toast(`${label} · practice (broker tak kuch nahi gaya)`, kind);
  refreshView();
}

async function setPower(on) {
  const p = practice();
  if (p.kill) return toast("Kill Latch laga hai. Pehle 'Kill hatao' (RESET likh kar).", "bad");
  if ((p.power === "on") === on) return;
  const ok = on
    ? await confirmDialog({ title: "Bot ON karein?", body: `Bot ${p.mode === "real" ? "REAL MONEY" : "Paper"} mode mein naye mauke dhoondhega.`, confirmText: "Haan, ON karo" })
    : await confirmDialog({ title: "Bot OFF karein?", body: "Bot koi nayi entry nahi lega. Khula position apne Stop-Loss ke saath rahega; band karna ho toh 'Square-off sab' dabao.", confirmText: "Haan, OFF karo" });
  if (!ok) return refreshView();
  p.power = on ? "on" : "off";
  p.paused = false;
  save(p, on ? "Bot ON" : "Bot OFF", on ? "good" : "info");
}

async function setMode(mode) {
  const p = practice();
  if (p.mode === mode) return;
  if (p.kill) return toast("Kill Latch laga hai. Pehle use hatao.", "bad");
  if (mode === "real") {
    const ok = await confirmDialog({
      title: "REAL MONEY mode?",
      body: "Ab asli paise lagenge. Bot Real tabhi chalu karega jab teeno Gates (Backtest, Paper, Stage2) pass hon; warna woh mana kar dega. Nuksan ho sakta hai, profit ki koi guarantee nahi.",
      confirmText: "Real Money chalu karo",
      danger: true,
      typeToConfirm: "REAL",
    });
    if (!ok) return refreshView();
  } else if (!(await confirmDialog({ title: "Paper mode par wapas?", body: "Bot sirf nakli (paper) trade karega. Khula real position ho toh pehle use band karo.", confirmText: "Haan, Paper karo" }))) return refreshView();
  p.mode = mode;
  save(p, mode === "real" ? "Mode: REAL MONEY" : "Mode: Paper", mode === "real" ? "bad" : "good");
}

async function doAction(kind) {
  const p = practice();
  if (p.kill && kind !== "reset") return toast("Kill Latch laga hai. Pehle 'Kill hatao' (RESET likh kar).", "bad");
  if (kind === "pause") {
    if (p.power !== "on") return toast("Bot OFF hai; pause ki zaroorat nahi", "info");
    if (p.paused) {
      if (await confirmDialog({ title: "Pause hatayein?", body: "Bot phir se nayi entry dhoondhega.", confirmText: "Haan, chalu karo" })) {
        p.paused = false;
        save(p, "Pause hataya");
      }
      return;
    }
    if (await confirmDialog({ title: "Emergency Pause?", body: "Nayi entry turant band. Khula position apne Stop-Loss ke saath rahega.", confirmText: "Haan, pause karo" })) {
      p.paused = true;
      save(p, "Emergency Pause", "info");
    }
  } else if (kind === "squareoff") {
    const n = (ui.data?.positions || []).length;
    if (!n) return toast("Koi khula position nahi, square-off ki zaroorat nahi", "info");
    if (await confirmDialog({ title: "Sab position band karein?", body: `${n} khula position market daam par band hoga. Yeh wapas nahi hota.`, confirmText: "Haan, square-off", danger: true })) save(p, `Square-off (${n} position)`);
  } else if (kind === "kill") {
    if (await confirmDialog({ title: "KILL-SWITCH", body: "Sab turant band: nayi entry nahi, khule position band, bot ruka. Sirf RESET likh kar hatega.", confirmText: "KILL karo", danger: true, typeToConfirm: "KILL" })) {
      p.kill = true;
      p.power = "off";
      p.paused = false;
      save(p, "KILL-SWITCH", "bad");
    }
  } else if (kind === "reset") {
    if (!p.kill) return toast("Kill Latch laga hi nahi hai", "info");
    if (await confirmDialog({ title: "Kill Latch hatayein?", body: "Bot OFF haalat mein aayega. Chalu karne ke liye ON dabana hoga.", confirmText: "Hatao", typeToConfirm: "RESET" })) {
      p.kill = false;
      save(p, "Kill Latch hataya");
    }
  }
}

export function initControls() {
  const map = [
    ["pause", "Emergency Pause", "pause", "btn-secondary"],
    ["squareoff", "Square-off sab", "exit", "btn-secondary"],
    ["kill", "Kill-Switch", "power", "btn-danger"],
    ["reset", "Kill hatao", "refresh", "btn-ghost"],
  ];
  $("ct-buttons").replaceChildren(...map.map(([k, label, ic, kind]) => button(label, { iconName: ic, kind, onClick: () => doAction(k), attrs: { "data-action": k } })));
  $("ct-power").addEventListener("click", () => setPower(practice().power !== "on"));
  for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
  $("ct-clear").addEventListener("click", async () => {
    if (await confirmDialog({ title: "Practice log mitayein?", body: "Sirf is browser ka practice log mitega.", confirmText: "Mitao" })) {
      store.set(PKEY, { ...practice(), log: [] });
      toast("Practice log saaf", "good");
      refreshView();
    }
  });
}

export function renderControls() {
  const p = practice();
  const on = p.power === "on";
  const word = p.kill ? "KILL LATCH" : !on ? "OFF" : p.paused ? "PAUSE" : "ON";
  const cls = p.kill ? "bad" : !on ? "muted" : p.paused ? "warn" : "good";
  const ic = p.kill ? "power" : !on ? "stop" : p.paused ? "pause" : "play";
  const text = p.kill
    ? "Sab band. Sirf RESET likh kar hi wapas chalu hoga."
    : !on
      ? "Bot koi nayi entry nahi lega."
      : p.paused
        ? "Nayi entry band. Khula position SL ke saath chal raha hai."
        : `Bot ${p.mode === "real" ? "REAL MONEY" : "Paper"} mode mein mauke dhoondh raha hai.`;
  $("ct-state").replaceChildren(
    el("span", { class: `big-ic ${cls}` }, icon(ic)),
    el("div", {}, el("span", { class: "muted small", text: "Bot ki haalat (practice)" }), el("b", { class: `state-word ${cls}`, text: word }), el("p", { class: "muted small", text })),
  );
  const sw = $("ct-power");
  sw.setAttribute("aria-checked", String(on));
  sw.classList.toggle("is-on", on);
  sw.disabled = p.kill;
  $("ct-power-word").textContent = on ? "ON" : "OFF";
  for (const b of document.querySelectorAll("[data-mode]")) {
    b.setAttribute("aria-checked", String(b.dataset.mode === p.mode));
    b.disabled = p.kill;
  }
  $("ct-mode-note").textContent = p.mode === "real" ? "REAL MONEY chuna hai. Bot Gates pass hue bina Real chalu nahi karega." : "Paper chuna hai: sirf nakli trade, koi asli paisa nahi.";
  $("ct-mode-note").className = `small ${p.mode === "real" ? "tone-down" : "muted"}`;
  const pauseBtn = document.querySelector('[data-action="pause"] span');
  if (pauseBtn) pauseBtn.textContent = p.paused ? "Pause hatao" : "Emergency Pause";
  $("ct-log").replaceChildren(...(p.log.length ? p.log.map((l) => el("li", {}, el("time", { text: hhmm(l.at) }), el("span", { text: l.text }))) : [el("li", { class: "li-empty" }, empty("Abhi koi practice hukm nahi"))]));
}

/* ---------------- Activity log ---------------- */
const LEVELS = [["all", "Sab"], ["info", "Info"], ["good", "Achha"], ["warn", "Dhyan"], ["bad", "Bura"]];
const LEVEL_WORD = { info: "Info", good: "Achha", warn: "Dhyan", bad: "Bura" };

function filtered(d) {
  const q = ui.activity.q.trim().toLowerCase();
  return (d.events || []).filter((e) => (ui.activity.level === "all" || e.level === ui.activity.level) && (!q || String(e.text).toLowerCase().includes(q)));
}

export function initActivity() {
  const input = $("ac-search");
  input.addEventListener("input", () => {
    ui.activity.q = input.value;
    refreshView();
  });
  $("ac-export").addEventListener("click", () => {
    const rows = filtered(ui.data || {});
    if (!rows.length) return toast("Download karne ke liye kuch nahi", "info");
    downloadFile(`bot-activity-${istDate()}${ui.data?.demo ? "-NAKLI" : ""}.csv`, toCsv([["Samay (IST)", "Darja", "Khabar"], ...rows.map((e) => [fullTime(e.atMs), LEVEL_WORD[e.level] || e.level, e.text])]), "text/csv");
    toast(`${rows.length} line ki CSV download ho gayi`, "good");
  });
}

export function renderActivity(d) {
  const all = d.events || [];
  seg($("ac-levels"), LEVELS.map(([k, w]) => [k, w, k === "all" ? all.length : all.filter((e) => e.level === k).length]), ui.activity.level, (v) => {
    ui.activity.level = v;
    refreshView();
  }, "Darja chuno");
  const rows = filtered(d);
  $("ac-count").textContent = `${rows.length} khabar`;
  $("ac-list").replaceChildren(
    ...(rows.length
      ? rows.map((e) => el("li", {}, el("time", { text: hhmm(e.atMs) }), el("span", { class: `pin ${e.level || "info"}`, "aria-hidden": "true" }), el("span", { class: "ev-text", text: e.text }), el("span", { class: `lvl lvl-${e.level}`, text: LEVEL_WORD[e.level] || "" })))
      : [el("li", { class: "li-empty" }, empty("Is filter mein koi khabar nahi", "search"))]),
  );
}

/* ---------------- Setup checklist ---------------- */
const STEPS = [
  ["Website Vercel par lagao", "Naya project repo Bot-trading-website- se, Root Directory khaali."],
  ["Website sirf apne liye band karo", "Deployment Protection (Vercel Authentication) + Vercel par 2FA."],
  ["Upstox account taiyar karo", "TOTP chalu, ek hi API app (Algo Trading App)."],
  ["Ek server lo (sab kuch isi par)", "AWS Lightsail Mumbai $12 plan + static IP (~₹1,330/mahina). Bot aur Pehredaar dono yahin."],
  ["Pehredaar ko alag service banao", "Usi server par alag systemd service; bot ruk jaye toh bhi Pehredaar chale."],
  ["Server ka IP Upstox mein daalo", "Static IP market band hone ke baad; hafte mein ek baar hi badalta hai."],
  ["Chaabiyan server par encrypted rakho", "systemd-creds; chat/GitHub mein kabhi nahi."],
  ["Claude ko agla kaam do (M1)", "Live data feed, recorder, probe."],
  ["Roz ka niyam samjho", "Kuch dabana nahi; pehle Paper Mode; Telegram par login ki khabar."],
];
const SKEY = "bt-setup";

export function renderSetup() {
  const done = store.get(SKEY, [true]);
  const count = STEPS.filter((_, i) => done[i]).length;
  $("su-progress").replaceChildren(meter("Setup poora", `${count} / ${STEPS.length} step`, (count / STEPS.length) * 100, count === STEPS.length ? "good" : ""));
  $("su-list").replaceChildren(
    ...STEPS.map(([title, sub], i) => {
      const id = `su-${i}`;
      const box = el("input", { type: "checkbox", id, class: "check" });
      box.checked = Boolean(done[i]);
      box.addEventListener("change", () => {
        const next = store.get(SKEY, [true]);
        next[i] = box.checked;
        store.set(SKEY, next);
        toast(box.checked ? `Step ${i + 1} ho gaya` : `Step ${i + 1} wapas baaki`, box.checked ? "good" : "info");
        refreshView();
      });
      return el("li", { class: box.checked ? "done" : "" }, box, el("label", { for: id }, el("span", { class: "step-no", text: `Step ${i + 1}` }), el("b", { text: title }), el("span", { class: "muted small", text: sub })));
    }),
  );
}
