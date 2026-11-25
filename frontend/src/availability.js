// Helpers for searching several days and several times at once.
// A "slot" is one day paired with one time window, e.g. Tue Dec 1 · 6:00–8:00 PM.
// Picking 2 days and 2 time windows gives 4 slots.
export const MAX_SLOTS = 24;   // keep in sync with MAX_SLOTS in server/routers/rooms.py

const p2 = n => String(n).padStart(2, "0");
export const dayKey = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseDay = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };

const normTime = v => { const [h, m] = String(v || "").split(":").map(Number); return Number.isNaN(h) || Number.isNaN(m) ? "" : `${p2(h)}:${p2(m)}`; };
// "18:00" -> "6 PM", "18:30" -> "6:30 PM"
export const fmtTime = v => {
  const [h, m] = v.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? ":" + p2(m) : ""} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtWindow = (from, to) => `${fmtTime(from)} – ${fmtTime(to)}`;
export const fmtDay = k => parseDay(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const fmtDayLong = k => parseDay(k).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export const windowOk = w => !!normTime(w.from) && !!normTime(w.to) && normTime(w.to) > normTime(w.from);

// Every day x every complete time window, earliest first, without repeats.
// Slots that have already ended today are left out (the server skips them too).
// tooMany: more than MAX_SLOTS combinations, so the search isn't run.
export function buildSlots(dates, windows, now = new Date()) {
  const seen = new Set();
  const wins = windows.filter(windowOk)
    .map(w => ({ from: normTime(w.from), to: normTime(w.to) }))
    .filter(w => { const k = `${w.from}-${w.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const days = [...new Set(dates)].sort();
  const tooMany = days.length * wins.length > MAX_SLOTS;
  const slots = [];
  for (const date of days) {
    for (const w of wins) {
      const [h, m] = w.to.split(":").map(Number);
      const end = parseDay(date); end.setHours(h, m, 0, 0);
      if (end <= now) continue;
      slots.push({ key: `${date}|${w.from}-${w.to}`, date, from: w.from, to: w.to });
    }
  }
  return { slots, tooMany, combos: days.length * wins.length, dayCount: days.length, timeCount: wins.length };
}

// What the booking drawer starts with. The drawer gives each day one time,
// so a day picked with two time windows starts with its first one.
export function prefillFor(slots) {
  const days = [];
  for (const s of slots) if (!days.some(d => d.date === s.date)) days.push({ date: s.date, from: s.from, to: s.to });
  return { date: days[0].date, from: days[0].from, to: days[0].to, days };
}

// Every picked day again each week, up to and including `until` ("every Tuesday until finals").
// Only days that are really added are returned, in order. Capped at a year out.
export const MAX_REPEAT_DAYS = 366;
export function repeatUntil(dates, until) {
  const out = new Set(dates);
  for (const d of dates) for (let k = addDays(d, 7); k <= until && out.size < MAX_REPEAT_DAYS; k = addDays(k, 7)) out.add(k);
  return [...out].sort();
}
