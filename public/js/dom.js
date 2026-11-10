// Chhote, surakshit DOM helpers. HTML string kabhi nahi banti: har text textContent / text node se jaata hai.

export const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";
const MINUS = "−";

export function el(tag, attrs = {}, ...kids) {
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

export function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, String(v));
  for (const kid of kids) if (kid !== null && kid !== undefined) e.append(kid instanceof Node ? kid : String(kid));
  return e;
}

export function icon(name, cls = "ic") {
  const s = svg("svg", { class: cls, "aria-hidden": "true", focusable: "false" });
  s.append(svg("use", { href: `#i-${name}` }));
  return s;
}

/* ---------- formatting (en-IN: 1,23,456.00) ---------- */
export const fin = (v) => typeof v === "number" && Number.isFinite(v);
const nf2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const num = (v) => (fin(v) ? nf2.format(v) : "—");
export const int = (v) => (fin(v) ? nf0.format(v) : "—");
const sign = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "");
export const signed = (v) => (fin(v) ? sign(v) + nf2.format(Math.abs(v)) : "—");
export const money = (v) => (fin(v) ? (v < 0 ? MINUS : "") + "₹" + nf2.format(Math.abs(v)) : "—");
export const moneySigned = (v) => (fin(v) ? sign(v) + "₹" + nf2.format(Math.abs(v)) : "—");
export const tone = (v) => (!fin(v) || v === 0 ? "flat" : v > 0 ? "up" : "down");
export function compact(v) {
  if (!fin(v)) return "—";
  const a = Math.abs(v);
  const s = v < 0 ? MINUS : "";
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${a}`;
}
const fTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const fClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const fFull = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const fDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
export const istDate = (ms = Date.now()) => fDate.format(new Date(ms)); // YYYY-MM-DD (IST)
export const hhmm = (ms) => (fin(ms) ? fTime.format(new Date(ms)) : "—");
export const clock = (ms) => fClock.format(new Date(ms));
export const dayLabel = (ms) => (fin(ms) ? fDay.format(new Date(ms)) : "—");
export const fullTime = (ms) => (fin(ms) ? fFull.format(new Date(ms)) : "—");
export const ago = (ms) => (!fin(ms) ? "—" : ms < 1000 ? `${ms} ms pehle` : `${(ms / 1000).toFixed(1)} s pehle`);

/* ---------- browser storage (sirf is browser ki pasand; band ho toh default) ---------- */
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* koi baat nahi */
    }
  },
};

/* ---------- chhote UI tukde ---------- */
export function arrow(t) {
  return icon(t === "up" ? "up" : t === "down" ? "down" : "flat");
}
export function chg(change, pct) {
  const t = tone(change);
  return el("span", { class: `chg chg-${t}` }, arrow(t), `${signed(change)} (${signed(pct)}%)`);
}
export function empty(text, iconName = "empty") {
  return el("div", { class: "empty" }, icon(iconName), el("p", { text }));
}
export function stat(label, value, cls = "", sub = null) {
  return el("div", { class: "stat" }, el("span", { class: "stat-label", text: label }), el("b", { class: `stat-value ${cls}`, text: value }), sub ? el("span", { class: "stat-sub", text: sub }) : null);
}
export function meter(label, right, pct, cls = "") {
  const fill = el("i");
  const p = Math.max(0, Math.min(100, fin(pct) ? pct : 0));
  fill.style.setProperty("--w", `${p.toFixed(1)}%`);
  return el(
    "div",
    { class: "meter" },
    el("div", { class: "meter-top" }, el("span", { text: label }), el("span", { class: "meter-val", text: right })),
    el("div", { class: `bar ${cls}`, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(p)), "aria-label": label }, fill),
  );
}
export function seg(box, items, current, onPick, label) {
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", label);
  box.onkeydown = (e) => {
    const i = items.findIndex(([v]) => v === current);
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d || i < 0) return;
    e.preventDefault();
    onPick(items[(i + d + items.length) % items.length][0]);
    box.querySelector('[aria-checked="true"]')?.focus();
  };
  box.replaceChildren(
    ...items.map(([val, text, count]) =>
      el(
        "button",
        { type: "button", role: "radio", class: "seg-btn", tabindex: val === current ? "0" : "-1", "aria-checked": String(val === current), onclick: () => val !== current && onPick(val) },
        text,
        count === undefined ? null : el("span", { class: "count", text: String(count) }),
      ),
    ),
  );
}
export function toggleChip(label, on, onToggle, keyClass = "") {
  return el(
    "button",
    { type: "button", class: "chip-toggle", "aria-pressed": String(on), onclick: () => onToggle(!on) },
    keyClass ? el("i", { class: `key ${keyClass}`, "aria-hidden": "true" }) : null,
    label,
  );
}
export function button(label, { kind = "", iconName = null, onClick, title = null, attrs = {} } = {}) {
  return el("button", { type: "button", class: `btn ${kind}`, title, onclick: onClick, ...attrs }, iconName ? icon(iconName) : null, el("span", { text: label }));
}

/* ---------- toast (chhoti khabar) ---------- */
export function toast(text, kind = "info") {
  const box = $("toasts");
  const t = el("div", { class: `toast toast-${kind}`, role: "status" }, icon(kind === "bad" ? "alert" : kind === "good" ? "check" : "info"), el("span", { text }));
  box.append(t);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => t.classList.add("out"), 3800);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- dialog / sheet (native <dialog>: Esc se band, focus andar) ---------- */
export function openSheet({ title, body, side = "right", footer = null, onClose = null }) {
  const closeBtn = el("button", { type: "button", class: "icon-btn", "aria-label": "Band karo" }, icon("x"));
  const dlg = el(
    "dialog",
    { class: `sheet sheet-${side}`, "aria-label": title },
    el("div", { class: "sheet-head" }, el("h2", { text: title }), closeBtn),
    el("div", { class: "sheet-body" }, body),
    footer ? el("div", { class: "sheet-foot" }, footer) : null,
  );
  const close = () => dlg.close();
  closeBtn.addEventListener("click", close);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close(); // bahar (backdrop) click
  });
  dlg.addEventListener("close", () => {
    dlg.remove();
    if (onClose) onClose();
  });
  document.body.append(dlg);
  dlg.showModal();
  return { dialog: dlg, close };
}

export function confirmDialog({ title, body, confirmText = "Haan, karo", danger = false, typeToConfirm = null }) {
  return new Promise((resolve) => {
    let ok = false;
    const input = typeToConfirm
      ? el("input", { class: "input", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": `Pakka karne ke liye ${typeToConfirm} likho`, placeholder: typeToConfirm })
      : null;
    const yes = button(confirmText, { kind: danger ? "btn-danger-solid" : "btn-primary" });
    const no = button("Ruko, mat karo", { kind: "btn-ghost" });
    if (input) {
      yes.disabled = true;
      input.addEventListener("input", () => {
        yes.disabled = input.value.trim().toUpperCase() !== typeToConfirm;
      });
    }
    const content = el(
      "div",
      { class: "confirm" },
      el("p", { text: body }),
      input ? el("label", { class: "field" }, el("span", { class: "field-label", text: `Pakka karne ke liye "${typeToConfirm}" likho` }), input) : null,
    );
    const sheet = openSheet({
      title,
      body: content,
      side: "center",
      footer: el("div", { class: "row-end" }, no, yes),
      onClose: () => resolve(ok),
    });
    no.addEventListener("click", () => sheet.close());
    yes.addEventListener("click", () => {
      ok = true;
      sheet.close();
    });
    (input || no).focus();
  });
}

/* ---------- file download / copy ---------- */
export function downloadFile(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// CSV: har cell quote; "=", "+", "-", "@" se shuru hone wale text ke aage ' (spreadsheet formula se bachav).
export function toCsv(rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
