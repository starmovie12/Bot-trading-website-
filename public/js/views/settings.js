// Settings: (1) Risk niyam ka DRAFT (malik ke baaki faisle) - save, JSON download/copy.
// (2) Is browser ki pasand: theme, default index, refresh. Kuch bhi bot tak apne-aap nahi jaata.
import { $, istDate, confirmDialog, copyText, downloadFile, el, fullTime, store, toast } from "../dom.js";
import { ORDER, REFRESH_CHOICES, savePrefs, ui } from "../state.js";

const DKEY = "bt-risk-draft";
const FIELDS = ["capital", "totalLoss", "dailyLoss", "riskUnit", "maxEntries", "dataStale", "entryStart", "lastEntry", "breadth", "breadthList", "notes"];

const toMin = (t) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);

function readForm() {
  const f = $("st-form");
  const v = {};
  for (const k of FIELDS) {
    const node = f.elements[k];
    if (!node) continue;
    v[k] = typeof node.value === "string" ? node.value.trim() : "";
  }
  return v;
}

function validate(v) {
  const errs = {};
  const n = (k) => (v[k] === "" ? null : Number(v[k]));
  const capital = n("capital");
  const total = n("totalLoss");
  const daily = n("dailyLoss");
  const maxE = n("maxEntries");
  if (capital === null || !Number.isFinite(capital) || capital < 1000) errs.capital = "Kam se kam ₹1,000 likho";
  if (total === null || !Number.isFinite(total) || total <= 0) errs.totalLoss = "Yeh aapka sabse zaroori faisla hai: rupaye mein likho";
  else if (capital !== null && total > capital) errs.totalLoss = "Capital se zyada nahi ho sakta";
  if (daily === null || !Number.isFinite(daily) || daily <= 0) errs.dailyLoss = "Din ki seema rupaye mein likho";
  else if (total !== null && daily > total) errs.dailyLoss = "Kul seema se zyada nahi ho sakti";
  if (!v.riskUnit) errs.riskUnit = "Ek chuno";
  if (!v.dataStale) errs.dataStale = "Ek chuno";
  if (maxE !== null && (!Number.isInteger(maxE) || maxE < 1 || maxE > 10)) errs.maxEntries = "1 se 10 ke beech";
  const s = toMin(v.entryStart);
  const l = toMin(v.lastEntry);
  if (v.entryStart && (s === null || s < 9 * 60 + 15 || s > 15 * 60 + 30)) errs.entryStart = "9:15 aur 15:30 ke beech";
  if (v.lastEntry && (l === null || l < 9 * 60 + 15 || l > 15 * 60 + 30)) errs.lastEntry = "9:15 aur 15:30 ke beech";
  else if (s !== null && l !== null && l <= s) errs.lastEntry = "Pehli entry ke baad ka samay";
  if (v.breadth === "khud" && !v.breadthList) errs.breadthList = "Stocks ke naam comma se likho";
  return errs;
}

function showErrors(errs) {
  for (const k of FIELDS) {
    const msg = $(`err-${k}`);
    const field = $("st-form").elements[k];
    if (msg) {
      msg.textContent = errs[k] || "";
      msg.hidden = !errs[k];
    }
    if (field && field.setAttribute && !(field instanceof RadioNodeList)) {
      if (errs[k]) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
  }
}

function payload(v) {
  const num = (x) => (x === "" ? null : Number(x));
  return {
    _note: "Malik ke faisle (DRAFT). Claude inhe Bot-trading- repo ki config/niyam.toml mein bharega. Asli paise ki koi guarantee nahi.",
    savedAt: new Date().toISOString(),
    Capital_Rupaye: num(v.capital),
    Kul_Jeb_Nuksan_Seema: num(v.totalLoss),
    Din_Ki_Nuksan_Seema: num(v.dailyLoss),
    Risk_Limit_Ikai: v.riskUnit === "sl-count" ? "Stop-Loss ki ginti (din 1, hafta 2, mahina 4)" : "Percent",
    Max_Entry_Per_Din: num(v.maxEntries),
    Data_Purana_Hadd_ms: num(v.dataStale),
    Pehli_Entry_Samay: v.entryStart || null,
    Aakhri_Entry_Samay: v.lastEntry || null,
    Lot_Niyam: "Sirf 1 lot; premium quality pehle; sasta OTM nahi; paisa kam ho toh trade skip",
    Breadth_Stocks: v.breadth === "khud" ? v.breadthList.split(",").map((s) => s.trim()).filter(Boolean) : "Claude ka prastaav: vazan mein top 10",
    Notes: v.notes || null,
  };
}

function fill(v) {
  const f = $("st-form");
  for (const k of FIELDS) {
    const node = f.elements[k];
    if (node && v[k] !== undefined) node.value = v[k];
  }
  syncBreadth();
}

function syncBreadth() {
  const khud = $("st-form").elements.breadth.value === "khud";
  $("st-breadth-list").hidden = !khud;
}

function savedLine() {
  const s = store.get(DKEY, null);
  $("st-saved").textContent = s?.savedAt ? `Aakhri save: ${fullTime(Date.parse(s.savedAt))} (sirf is browser mein)` : "Abhi save nahi hua";
}

export function initSettings() {
  const f = $("st-form");
  const draft = store.get(DKEY, null);
  if (draft?.form) fill(draft.form);
  else fill({ capital: "15000" });
  savedLine();
  f.addEventListener("change", (e) => {
    if (e.target.name === "breadth") syncBreadth();
  });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = readForm();
    const errs = validate(v);
    showErrors(errs);
    const bad = Object.keys(errs);
    if (bad.length) {
      const first = f.elements[bad[0]];
      (first instanceof RadioNodeList ? first[0] : first)?.focus();
      return toast(`${bad.length} jagah sudhaar chahiye (laal likha dekho)`, "bad");
    }
    store.set(DKEY, { form: v, savedAt: new Date().toISOString() });
    savedLine();
    toast("Draft save ho gaya (sirf is browser mein)", "good");
  });
  const ready = () => {
    const v = readForm();
    const errs = validate(v);
    showErrors(errs);
    if (Object.keys(errs).length) {
      toast("Pehle laal likhi galtiyan theek karo", "bad");
      return null;
    }
    return JSON.stringify(payload(v), null, 2);
  };
  $("st-download").addEventListener("click", () => {
    const text = ready();
    if (!text) return;
    downloadFile(`bot-faisle-draft-${istDate()}.json`, text, "application/json");
    toast("JSON download ho gaya. Ise Claude ko de sakte ho.", "good");
  });
  $("st-copy").addEventListener("click", async () => {
    const text = ready();
    if (!text) return;
    const ok = await copyText(text);
    toast(ok ? "JSON copy ho gaya" : "Copy nahi hua; Download use karo", ok ? "good" : "bad");
  });
  $("st-reset").addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Form khaali karein?", body: "Draft is browser se mit jayega.", confirmText: "Haan, mitao", danger: true }))) return;
    store.remove(DKEY);
    f.reset();
    fill({ capital: "15000" });
    showErrors({});
    savedLine();
    toast("Form khaali", "info");
  });

  // Pasand
  const theme = $("pf-theme");
  theme.value = document.documentElement.dataset.theme || "system";
  theme.addEventListener("change", () => {
    window.dispatchEvent(new CustomEvent("bt-theme", { detail: theme.value }));
    toast("Theme badal gaya", "good");
  });
  const idx = $("pf-index");
  idx.replaceChildren(...ORDER.map((n) => el("option", { value: n, text: n === "Nifty50" ? "Nifty 50" : n === "BankNifty" ? "Bank Nifty" : "Sensex" })));
  idx.value = ui.prefs.defaultIdx;
  idx.addEventListener("change", () => {
    ui.prefs.defaultIdx = idx.value;
    ui.chart.idx = idx.value;
    ui.chain.idx = idx.value;
    savePrefs();
    toast("Default index save", "good");
  });
  const rf = $("pf-refresh");
  rf.replaceChildren(...REFRESH_CHOICES.map((s) => el("option", { value: String(s), text: `Har ${s} second` })));
  rf.value = String(ui.prefs.refreshS);
  rf.addEventListener("change", () => {
    ui.prefs.refreshS = Number(rf.value);
    savePrefs();
    window.dispatchEvent(new Event("bt-restart"));
    toast(`Ab har ${rf.value} second refresh`, "good");
  });
  $("pf-wipe").addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "Is browser ka saara data mitayein?", body: "Theme, pasand, draft, practice log aur setup checklist mit jayenge. Bot ya GitHub par kuch nahi badlega.", confirmText: "Sab mitao", danger: true, typeToConfirm: "MITAO" }))) return;
    for (const k of ["bt-prefs", "bt-theme", DKEY, "bt-practice", "bt-setup", "bt-seen"]) store.remove(k);
    location.reload();
  });
}

export function renderSettings() {
  $("pf-refresh").value = String(ui.prefs.refreshS);
  $("pf-theme").value = document.documentElement.dataset.theme || "system";
}
