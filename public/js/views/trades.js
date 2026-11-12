// Trades: positions / orders / trade book + CSV download.
import { $, istDate, button, downloadFile, el, empty, fullTime, hhmm, money, moneySigned, num, seg, stat, toCsv, toast, tone } from "../dom.js";
import { refreshView, ui } from "../state.js";
import { positionCard } from "./overview.js";

const STATUS = { COMPLETE: ["st-complete", "Poora"], "TRIGGER PENDING": ["st-pending", "SL intezaar"], OPEN: ["st-pending", "Khula"], CANCELLED: ["st-cancelled", "Radd"], REJECTED: ["st-rejected", "Reject"] };

function orderRow(o) {
  const [cls, word] = STATUS[o.status] || ["st-cancelled", o.status];
  return el(
    "article",
    { class: "row-item" },
    el("div", { class: "row-main" }, el("div", { class: "row-title" }, el("span", { class: `tag tag-${String(o.side).toLowerCase()}`, text: o.side === "BUY" ? "BUY" : "SELL" }), el("span", { text: o.symbol })), el("div", { class: "row-sub", text: `${hhmm(o.atMs)} · ${o.kind} · ${o.lots ?? 1} lot` })),
    el("div", { class: "row-end-col" }, el("b", { text: num(o.price) }), el("span", { class: `status ${cls}`, text: word })),
  );
}

function bookRow(b) {
  return el(
    "article",
    { class: "row-item" },
    el("div", { class: "row-main" }, el("div", { class: "row-title" }, el("span", { text: b.symbol })), el("div", { class: "row-sub", text: `${hhmm(b.entryAtMs)} → ${hhmm(b.exitAtMs)} · ${num(b.avg)} → ${num(b.exit)} · ${b.reason || ""}` })),
    el("div", { class: "row-end-col" }, el("b", { class: `tone-${tone(b.pnl)}`, text: moneySigned(b.pnl) }), el("span", { class: "row-sub", text: `${b.lots ?? 1} lot` })),
  );
}

function exportCsv(d) {
  const tab = ui.trades.tab;
  let rows;
  if (tab === "orders") rows = [["Samay (IST)", "Symbol", "Side", "Type", "Daam", "Status", "Lot"], ...(d.orders || []).map((o) => [fullTime(o.atMs), o.symbol, o.side, o.kind, o.price, o.status, o.lots ?? 1])];
  else if (tab === "book") rows = [["Entry (IST)", "Exit (IST)", "Symbol", "Avg", "Exit daam", "P&L", "Wajah"], ...(d.tradeBook || []).map((b) => [fullTime(b.entryAtMs), fullTime(b.exitAtMs), b.symbol, b.avg, b.exit, b.pnl, b.reason])];
  else rows = [["Symbol", "Lot", "Avg", "LTP", "SL", "Target", "P&L"], ...(d.positions || []).map((p) => [p.symbol, p.lots, p.avg, p.ltp, p.sl, p.target, p.pnl])];
  if (rows.length < 2) return toast("Download karne ke liye kuch nahi hai", "info");
  downloadFile(`bot-${tab}-${istDate()}${d.demo ? "-NAKLI" : ""}.csv`, toCsv(rows), "text/csv");
  toast(`${rows.length - 1} line ki CSV download ho gayi`, "good");
}

export function initTrades() {
  $("tr-actions").replaceChildren(button("CSV download", { iconName: "download", kind: "btn-secondary", onClick: () => ui.data && exportCsv(ui.data) }));
}

export function renderTrades(d) {
  const p = d.pnl || {};
  const pos = d.positions || [];
  const orders = d.orders || [];
  const book = d.tradeBook || [];
  const wins = book.filter((b) => b.pnl > 0).length;
  $("tr-stats").replaceChildren(
    stat("Net P&L", moneySigned(p.net), `tone-${tone(p.net)}`, "kharche ke baad"),
    stat("Realised", moneySigned(p.realised), `tone-${tone(p.realised)}`, `${book.length} trade band`),
    stat("Unrealised", moneySigned(p.unrealised), `tone-${tone(p.unrealised)}`, `${pos.length} khula`),
    stat("Jeet / Haar", book.length ? `${wins} / ${book.length - wins}` : "—", "", `kharcha ${money(p.charges)}`),
  );
  seg($("tr-tabs"), [["positions", "Positions", pos.length], ["orders", "Orders", orders.length], ["book", "Trade book", book.length]], ui.trades.tab, (v) => {
    ui.trades.tab = v;
    refreshView();
  }, "Trades ke hisse");
  let list;
  if (ui.trades.tab === "orders") list = orders.length ? orders.map(orderRow) : [empty("Aaj koi order nahi")];
  else if (ui.trades.tab === "book") list = book.length ? book.map(bookRow) : [empty("Aaj koi trade band nahi hua")];
  else list = pos.length ? pos.map(positionCard) : [empty("Koi khula position nahi. Bot ek samay par sirf 1 lot rakhta hai.")];
  $("tr-list").replaceChildren(...list);
}
