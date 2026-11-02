import { useEffect, useRef, useState } from 'react';

// A Google-Calendar-style week: seven day columns, hours down the side, events as blocks.
//
//   weekStart      the Sunday (00:00) of the week on screen
//   onWeekChange   called with the new Sunday when the arrows or "Today" are used
//   events         [{ id, start: Date, end: Date, title, sub?, kind }]  kind: see KINDS
//   selection      { key: "YYYY-MM-DD", start: min, end: min, clash?: bool } | null   (a pick drawn on the grid)
//   onSelect       if given, you can click or drag on an empty time to pick it: (key, startMin, endMin)
//   noPast         true: no earlier weeks, and times that have passed can't be picked
//   fromMin/toMin  the hours shown, in minutes since midnight
//   maxHeight      the grid scrolls inside this height
export const KINDS = {
  booked:   { label: "Booked",           bg: "var(--slate-wash)", border: "var(--ink-faint)", fg: "var(--ink)" },
  approved: { label: "Approved",         bg: "var(--green-wash)", border: "var(--green)",     fg: "var(--ink)" },
  pending:  { label: "Requested",        bg: "var(--amber-wash)", border: "var(--amber)",     fg: "var(--ink)", dashed: true },
  waitlist: { label: "Waitlist",         bg: "var(--card)",       border: "var(--ink-faint)", fg: "var(--ink-soft)", dashed: true },
  closed:   { label: "Closed",           bg: "var(--line)",       border: "var(--ink-faint)", fg: "var(--ink-soft)", hatch: true },
  mine:     { label: "Your choice",      bg: "var(--blue)",       border: "var(--ink)",       fg: "var(--ink)" },
};

const HOUR_H = 52;   // pixels per hour
const SNAP = 15;     // minutes
const GUTTER = 56;   // width of the time labels
const DAY_MS = 86400000;

const p2 = n => String(n).padStart(2, "0");
export const dayKey = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const keyToDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const startOfWeek = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const fmt12 = m => { const h = Math.floor(m / 60) % 24; return `${((h + 11) % 12) + 1}:${p2(m % 60)} ${h < 12 ? "AM" : "PM"}`; };
const hourLabel = h => `${((h + 11) % 12) + 1} ${h < 12 || h === 24 ? "AM" : "PM"}`;
const snap = m => Math.floor(m / SNAP) * SNAP;

// The part of each event that falls on `day`, as minutes (clipped to the hours shown).
function minutesOn(day, ev, fromMin, toMin) {
  const dayStart = day.getTime();
  const s = Math.max(ev.start.getTime(), dayStart), e = Math.min(ev.end.getTime(), dayStart + DAY_MS);
  if (e <= s) return null;
  const a = Math.max(Math.round((s - dayStart) / 60000), fromMin), b = Math.min(Math.round((e - dayStart) / 60000), toMin);
  return b > a ? { s: a, e: b } : null;
}

// Side-by-side lanes for events that overlap in time.
function lanes(list) {
  const sorted = [...list].sort((x, y) => x.s - y.s || y.e - x.e);
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => {
    const ends = [];
    for (const it of cluster) {
      let i = ends.findIndex(end => end <= it.s);
      if (i < 0) { i = ends.length; ends.push(0); }
      ends[i] = it.e; it.lane = i;
    }
    cluster.forEach(it => { it.lanes = ends.length; });
    out.push(...cluster); cluster = []; clusterEnd = -1;
  };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

const navBtn = { height: 36, minWidth: 36, padding: "0 12px", borderRadius: 8, border: "2px solid var(--ink)", color: "var(--ink)",
  background: "var(--card)", fontWeight: 700, fontSize: 15 };

export default function WeekCalendar({ weekStart, onWeekChange, events = [], selection = null, onSelect, noPast = false,
  fromMin = 360, toMin = 1440, maxHeight = 560, loading = false }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = dayKey(new Date());
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => { const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60000); return () => clearInterval(t); }, []);

  // Start with the morning in view.
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = Math.max(0, (8 * 60 - fromMin) / 60 * HOUR_H - 8); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [drag, setDrag] = useState(null);   // { key, a, b } while the mouse is down
  const dragged = useRef(false);
  const total = (toMin - fromMin) / 60 * HOUR_H;
  const hours = []; for (let h = Math.ceil(fromMin / 60); h < toMin / 60; h++) hours.push(h);

  const thisWeek = startOfWeek(new Date());
  const canPrev = !noPast || weekStart > thisWeek;
  const rangeLabel = (() => {
    const last = addDays(weekStart, 6), mon = d => d.toLocaleDateString("en-US", { month: "short" });
    const a = `${mon(weekStart)} ${weekStart.getDate()}`;
    if (weekStart.getFullYear() !== last.getFullYear()) return `${a}, ${weekStart.getFullYear()} – ${mon(last)} ${last.getDate()}, ${last.getFullYear()}`;
    return `${a} – ${weekStart.getMonth() === last.getMonth() ? "" : mon(last) + " "}${last.getDate()}, ${last.getFullYear()}`;
  })();

  const minuteAt = (e, el) => {
    const y = e.clientY - el.getBoundingClientRect().top;
    return Math.min(toMin - SNAP, Math.max(fromMin, snap(fromMin + (y / HOUR_H) * 60)));
  };
  const isPast = (key, minute) => noPast && (key < todayKey || (key === todayKey && minute + SNAP <= nowMin));

  const down = (e, key) => {
    if (!onSelect || e.button > 0) return;
    const m = minuteAt(e, e.currentTarget);
    if (isPast(key, m)) return;
    dragged.current = false;
    if (e.pointerType !== "touch") e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ key, a: m, b: m, touch: e.pointerType === "touch" });
  };
  const move = (e) => {
    if (!drag || drag.touch) return;
    const m = minuteAt(e, e.currentTarget);
    if (m !== drag.b) { dragged.current = true; setDrag(d => d && { ...d, b: m }); }
  };
  const up = () => {
    if (!drag) return;
    const { key, a, b } = drag; setDrag(null);
    let s = Math.min(a, b), en = Math.max(a, b) + SNAP;
    if (a === b) en = s + 60;                       // a click picks an hour
    en = Math.min(en, toMin);
    if (en - s < SNAP) s = en - SNAP;
    if (noPast && key === todayKey && s < nowMin) s = Math.min(snap(nowMin + SNAP - 1), en - SNAP);
    onSelect(key, s, en);
  };

  const top = m => (m - fromMin) / 60 * HOUR_H;
  const sel = drag ? { key: drag.key, start: Math.min(drag.a, drag.b), end: Math.max(drag.a, drag.b) + SNAP, drag: true } : selection;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => onWeekChange(addDays(weekStart, -7))} disabled={!canPrev} aria-label="Previous week" style={{ ...navBtn, opacity: canPrev ? 1 : .35 }}>‹</button>
        <button onClick={() => onWeekChange(addDays(weekStart, 7))} aria-label="Next week" style={navBtn}>›</button>
        <button onClick={() => onWeekChange(thisWeek)} style={navBtn}>Today</button>
        <div style={{ fontWeight: 700, fontSize: 17, marginLeft: 4 }} aria-live="polite">{rangeLabel}</div>
        {loading && <span style={{ fontSize: 13.5, color: "var(--ink-faint)", fontWeight: 600 }}>Loading…</span>}
      </div>

      <div ref={scroller} className="wc-scroll" style={{ border: "2px solid var(--ink)", borderRadius: 12, background: "var(--card)", overflow: "auto", maxHeight }}>
        <div style={{ minWidth: 700 }}>
          {/* day headers */}
          <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`, position: "sticky", top: 0, zIndex: 4,
            background: "var(--card)", borderBottom: "2px solid var(--ink)" }}>
            <div />
            {days.map(d => {
              const k = dayKey(d), today = k === todayKey;
              return (
                <div key={k} style={{ textAlign: "center", padding: "7px 2px", borderLeft: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: today ? "var(--link)" : "var(--ink-faint)", textTransform: "uppercase" }}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div style={{ display: "inline-grid", placeItems: "center", width: 32, height: 32, borderRadius: 999, fontSize: 17, fontWeight: 800,
                    background: today ? "var(--ink)" : "transparent", color: today ? "#fff" : "var(--ink)" }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* time labels + day columns */}
          <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`, position: "relative", height: total }}>
            <div style={{ position: "relative" }}>
              {hours.map(h => (
                <div key={h} style={{ position: "absolute", top: Math.max(top(h * 60) - 8, 2), right: 8, fontSize: 11.5, fontWeight: 600, color: "var(--ink-faint)" }}>{hourLabel(h)}</div>
              ))}
            </div>
            {days.map(d => {
              const k = dayKey(d);
              const items = lanes(events.map(ev => { const r = minutesOn(d, ev, fromMin, toMin); return r && { ev, ...r }; }).filter(Boolean));
              const mySel = sel && sel.key === k ? sel : null;
              const pastTo = noPast ? (k < todayKey ? toMin : k === todayKey ? Math.min(toMin, Math.max(fromMin, nowMin)) : 0) : 0;
              return (
                <div key={k} data-day={k} role="group" aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  onPointerDown={e => down(e, k)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
                  style={{ position: "relative", borderLeft: "1px solid var(--line)", touchAction: onSelect ? "pan-y" : "auto",
                    cursor: onSelect ? "crosshair" : "default", userSelect: "none",
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_H - 1}px, var(--line-soft) ${HOUR_H - 1}px, var(--line-soft) ${HOUR_H}px)` }}>
                  {pastTo > fromMin && (
                    <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: top(pastTo), background: "rgba(94,106,130,.10)", pointerEvents: "none" }} />
                  )}
                  {items.map(({ ev, s, e, lane, lanes: n }, i) => {
                    const st = KINDS[ev.kind] || KINDS.booked, h = top(e) - top(s);
                    return (
                      <div key={`${ev.id}-${i}`} onPointerDown={x => x.stopPropagation()}
                        title={`${ev.title}${ev.sub ? ` · ${ev.sub}` : ""} · ${fmt12(s)}–${fmt12(e)}`}
                        style={{ position: "absolute", top: top(s) + 1, height: Math.max(h - 2, 14), left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`,
                          background: st.hatch ? `repeating-linear-gradient(45deg, ${st.bg}, ${st.bg} 5px, var(--paper) 5px, var(--paper) 10px)` : st.bg,
                          color: st.fg, border: `2px ${st.dashed ? "dashed" : "solid"} ${st.border}`, borderRadius: 6, padding: "2px 5px", overflow: "hidden",
                          fontSize: 12, lineHeight: 1.25, cursor: "default", zIndex: 1 }}>
                        <div style={{ fontWeight: 800, whiteSpace: h < 34 ? "nowrap" : "normal", textOverflow: "ellipsis", overflow: "hidden" }}>{ev.title}</div>
                        {h >= 34 && <div style={{ opacity: .85 }}>{fmt12(s)}–{fmt12(e)}</div>}
                        {h >= 62 && ev.sub && <div style={{ opacity: .85 }}>{ev.sub}</div>}
                      </div>
                    );
                  })}
                  {mySel && mySel.end > fromMin && mySel.start < toMin && (
                    <div data-selection aria-label={`Selected ${fmt12(mySel.start)} to ${fmt12(mySel.end)}`}
                      style={{ position: "absolute", top: top(Math.max(mySel.start, fromMin)), height: Math.max(top(Math.min(mySel.end, toMin)) - top(Math.max(mySel.start, fromMin)), 14),
                        left: 2, right: 2, zIndex: 3, pointerEvents: "none", borderRadius: 6, padding: "3px 6px", fontSize: 12.5, fontWeight: 800,
                        background: mySel.clash ? "var(--red-wash)" : "var(--blue)", color: mySel.clash ? "var(--red)" : "var(--ink)",
                        border: `2px solid ${mySel.clash ? "var(--red)" : "var(--ink)"}`, boxShadow: "2px 2px 0 var(--ink)", opacity: mySel.drag ? .85 : 1 }}>
                      {fmt12(mySel.start)} – {fmt12(mySel.end)}
                    </div>
                  )}
                  {k === todayKey && nowMin >= fromMin && nowMin <= toMin && (
                    <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: top(nowMin), height: 0, borderTop: "2px solid var(--red)", zIndex: 2, pointerEvents: "none" }}>
                      <span style={{ position: "absolute", left: -5, top: -6, width: 10, height: 10, borderRadius: 999, background: "var(--red)" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// "What the colours mean" row.
export function CalendarLegend({ kinds = ["booked", "approved", "pending", "waitlist", "closed", "mine"] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--ink-soft)", marginTop: 10 }}>
      {kinds.map(k => {
        const st = KINDS[k];
        return (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: st.bg, border: `2px ${st.dashed ? "dashed" : "solid"} ${st.border}` }} />
            {st.label}
          </span>
        );
      })}
    </div>
  );
}
