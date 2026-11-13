import { KINDS } from './WeekCalendar.jsx';
import { spaceLabel, columnsFor } from '../calendarData.js';

// One day of a room that is made of smaller spaces (a lobby and its tables): a column for each space, so you can
// see at a glance which one is free. Bookings of the whole room or a whole area run down every column they cover.
const FIRST = 7, LAST = 23, ROW_H = 40, GUTTER = 52, COL_MIN = 78;
const p2 = n => String(n).padStart(2, "0");
const hourLabel = h => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const dayKeyOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const mins = d => d.getHours() * 60 + d.getMinutes();
const fmt = m => `${((Math.floor(m / 60) + 11) % 12) + 1}:${p2(m % 60)}${m < 720 || m >= 1440 ? "a" : "p"}`;

export default function SpaceDayGrid({ parts, events, mine = [], day, onDayChange, onPick, loading }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const key = dayKeyOf(day), isPast = day < today;
  const shift = n => { const d = new Date(day); d.setDate(d.getDate() + n); onDayChange(d); };
  const colOf = ev => columnsFor(parts, ev.spaceName);   // which columns a booking covers
  const todays = events.filter(e => e.kind !== "closed" && dayKeyOf(e.start) === key);
  const blocks = [];
  for (const ev of todays) for (const id of colOf(ev)) blocks.push({ ev, id, whole: colOf(ev).length > 1 });
  const grid = (LAST - FIRST) * ROW_H;
  const top = m => ((m / 60) - FIRST) * ROW_H;
  const click = (e, id) => {
    if (isPast) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const start = Math.max(FIRST * 60, Math.min((LAST - 1) * 60, Math.floor((y / ROW_H + FIRST) * 2) * 30));
    onPick(id, key, start);
  };
  const groups = [...new Set(parts.map(p => p.group || ""))];
  const cell = { flex:`1 0 ${COL_MIN}px`, minWidth:COL_MIN, borderLeft:"1px solid var(--line)", position:"relative" };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
        <button onClick={() => shift(-1)} disabled={day <= today} aria-label="Previous day" style={{ width:34, height:34, borderRadius:8, border:"2px solid var(--ink)", background:"var(--card)", fontWeight:700, opacity: day <= today ? .4 : 1 }}>‹</button>
        <button onClick={() => shift(1)} aria-label="Next day" style={{ width:34, height:34, borderRadius:8, border:"2px solid var(--ink)", background:"var(--card)", fontWeight:700 }}>›</button>
        <button onClick={() => onDayChange(today)} style={{ padding:"6px 12px", borderRadius:8, border:"2px solid var(--ink)", background:"var(--card)", fontWeight:700 }}>Today</button>
        <div style={{ fontWeight:800, fontSize:16 }}>{day.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</div>
        {loading && <span style={{ fontSize:13, color:"var(--ink-faint)" }}>Loading…</span>}
      </div>
      <div style={{ border:"2px solid var(--ink)", borderRadius:12, background:"var(--card)", overflow:"hidden" }}>
        <div style={{ overflow:"auto", maxHeight:600 }}>
          <div style={{ minWidth: GUTTER + COL_MIN * parts.length }}>
            <div style={{ display:"flex", position:"sticky", top:0, zIndex:3, background:"var(--card)", borderBottom:"2px solid var(--ink)" }}>
              <div style={{ width:GUTTER, flexShrink:0 }} />
              {parts.map(p => (
                <div key={p.id} title={p.name} style={{ ...cell, padding:"8px 4px", textAlign:"center", fontWeight:700, fontSize:13.5 }}>
                  {spaceLabel(p.name)}
                  {groups.length > 1 && p.group && <div style={{ fontSize:11, fontWeight:600, color:"var(--ink-faint)" }}>{spaceLabel(p.group).replace(/ \(all\)$/, "")}</div>}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", height:grid }}>
              <div style={{ width:GUTTER, flexShrink:0, position:"relative" }}>
                {Array.from({ length: LAST - FIRST }, (_, i) => (
                  <div key={i} style={{ position:"absolute", top:i * ROW_H - 7, right:6, fontSize:11.5, color:"var(--ink-faint)", fontWeight:600 }}>{i ? hourLabel(FIRST + i) : ""}</div>
                ))}
              </div>
              {parts.map(p => (
                <div key={p.id} onClick={e => click(e, p.id)} aria-label={`Pick a time in ${spaceLabel(p.name)}`}
                  style={{ ...cell, cursor: isPast ? "default" : "pointer", opacity: isPast ? .6 : 1,
                    backgroundImage:`repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H - 1}px, var(--line) ${ROW_H - 1}px, var(--line) ${ROW_H}px)` }}>
                  {blocks.filter(b => b.id === p.id).map(({ ev, whole }, i) => {
                    const k = KINDS[ev.kind] || KINDS.booked;
                    const s = Math.max(FIRST * 60, mins(ev.start)), e = Math.min(LAST * 60, Math.max(mins(ev.end), s + 20));
                    return (
                      <div key={ev.id + i} title={`${ev.title}\n${fmt(mins(ev.start))}–${fmt(mins(ev.end))}${whole ? "\nBooked for more than one space" : ""}`} onClick={e2 => e2.stopPropagation()}
                        style={{ position:"absolute", left:2, right:2, top:top(s), height:Math.max(18, top(e) - top(s) - 1), overflow:"hidden", borderRadius:6, padding:"2px 5px", zIndex: whole ? 0 : 1,
                          background: whole ? `repeating-linear-gradient(135deg, ${k.bg}, ${k.bg} 6px, var(--card) 6px, var(--card) 9px)` : k.bg,
                          border:`2px ${k.dashed ? "dashed" : "solid"} ${k.border}`, color:k.fg, fontSize:11.5, lineHeight:1.2 }}>
                        <b>{ev.title.replace(/ · .*$/, "")}</b>
                        <div style={{ opacity:.85 }}>{fmt(mins(ev.start))}–{fmt(mins(ev.end))}</div>
                      </div>
                    );
                  })}
                  {mine.filter(m => m.spaceId === p.id && dayKeyOf(m.start) === key).map(m => (
                    <div key={m.id} onClick={e2 => e2.stopPropagation()} style={{ position:"absolute", left:2, right:2, top:top(mins(m.start)), height:Math.max(18, top(mins(m.end)) - top(mins(m.start)) - 1),
                      borderRadius:6, padding:"2px 5px", background:KINDS.mine.bg, border:`2px solid ${KINDS.mine.border}`, fontSize:11.5, fontWeight:700, overflow:"hidden", zIndex:2 }}>
                      {m.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:6 }}>Click an empty time in a column to book that space. Striped blocks are booked for more than one space.</div>
    </div>
  );
}
