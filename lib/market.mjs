// Market ka samay (IST). Server aur tests dono yahi use karte hain.
// Dhyan: cash market 9:15-15:30 IST hai. Kuch naye sources ke hisaab se F&O ab 15:40 tak chalta hai;
// yeh "verify nahi hua" hai (NSE circular se pakka karna hai). Isliye samay sirf yahan ek jagah likha hai.
// Chhutti (holiday) ki list abhi nahi jaanchi jaati.

export const IST_OFFSET_MS = 330 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION = { openMin: 9 * 60 + 15, closeMin: 15 * 60 + 30, label: "9:15-15:30 IST" };
export const SESSION_NOTE = "F&O ka band hone ka samay (15:30 ya 15:40) verify nahi hua; chhutti ki list nahi jaanchi";

export function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return { dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), sec: d.getUTCSeconds() };
}

export function istMidnightMs(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS;
}

export function isWeekday(ms) {
  const dow = istParts(ms).dow;
  return dow >= 1 && dow <= 5;
}

// "khula" | "pre-open" | "band"
export function marketStatus(ms) {
  if (!isWeekday(ms)) return "band";
  const { min } = istParts(ms);
  if (min < SESSION.openMin) return min >= SESSION.openMin - 15 ? "pre-open" : "band";
  return min < SESSION.closeMin ? "khula" : "band";
}

// Kaunse din ka session dikhana hai: aaj (agar market khul chuka) warna pichhla weekday.
export function sessionDayMs(ms) {
  let day = istMidnightMs(ms);
  if (isWeekday(ms) && istParts(ms).min >= SESSION.openMin) return day;
  do day -= DAY_MS;
  while (!isWeekday(day + 12 * 60 * 60 * 1000));
  return day;
}

// Session shuru hone ke baad kitne poore minute beete (0..sessionLength). Session khatam ho toh poora din.
export function minutesIntoSession(ms) {
  const length = SESSION.closeMin - SESSION.openMin;
  const day = sessionDayMs(ms);
  const open = day + SESSION.openMin * 60 * 1000;
  return Math.max(0, Math.min(length, Math.floor((ms - open) / 60000)));
}

// Upstox token agle din 3:30 AM IST par khatam hota hai (Upstox docs, dekha 10 Nov 2026).
export function nextTokenExpiryMs(ms) {
  const at = istMidnightMs(ms) + (3 * 60 + 30) * 60 * 1000;
  return at > ms ? at : at + DAY_MS;
}
