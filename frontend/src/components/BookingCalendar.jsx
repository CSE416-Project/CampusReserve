import { useMemo, useRef, useState } from 'react';
import WeekCalendar, { CalendarLegend, startOfWeek, addDays, keyToDate, dayKey, fmt12 } from './WeekCalendar.jsx';
import { useRoomWeek } from '../calendarData.js';
import useDialog from '../a11y/useDialog.js';
import { useScrollLock, useIsPhone } from '../useMedia.js';

const label = k => keyToDate(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// A full-screen week calendar for one room: everyone's bookings are visible, and you click or
// drag on an empty time to pick it. "Use this time" hands the pick back to the booking form.
export default function BookingCalendar({ room, dates = [], start, end, onPick, onClose }) {
  const first = dates.filter(k => k >= dayKey(new Date())).sort()[0];
  const [weekStart, setWeekStart] = useState(() => startOfWeek(first ? keyToDate(first) : new Date()));
  const [sel, setSel] = useState(null);                       // { key, start, end }
  const { events, loading, error, retry } = useRoomWeek(room, weekStart);
  const panel = useRef(null);
  const phone = useIsPhone();
  useDialog(panel, { open: true, onClose });
  const downOnBackdrop = useRef(false);   // only a click that starts AND ends on the dark area closes it (not the end of a drag)
  useScrollLock(true);

  // What you've already chosen in the form shows up as yellow blocks.
  const mine = useMemo(() => dates.map(k => {
    const d = keyToDate(k);
    return { id: `mine-${k}`, kind: "mine", title: "Your choice", sub: "Already picked",
      start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, start), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, end) };
  }), [dates, start, end]);

  // Does the pick overlap somebody else's booking, request or a closure?
  const clash = useMemo(() => {
    if (!sel) return [];
    const d = keyToDate(sel.key);
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, sel.start), e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, sel.end);
    return events.filter(ev => ev.kind !== "waitlist" && (ev.blockedStart || ev.start) < e && (ev.blockedEnd || ev.end) > s);
  }, [sel, events]);

  return (
    <div onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(27,42,74,.5)", display: "grid", placeItems: phone ? "stretch" : "center", padding: phone ? 0 : 20 }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`Calendar for ${room.name}`} tabIndex={-1}
        style={{ width: "100%", maxWidth: 1060, maxHeight: phone ? "100dvh" : "94vh", overflow: "auto", background: "var(--card)", border: phone ? "none" : "2px solid var(--ink)",
          borderRadius: phone ? 0 : 16, boxShadow: "var(--shadow-lift)", padding: phone ? "16px 14px" : "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 24, margin: 0 }}>Pick a time on the calendar</h2>
            <div style={{ fontSize: 15, color: "var(--ink-faint)" }}>{room.name} · {room.building}. Click an empty time, or drag to choose how long.</div>
          </div>
          <button onClick={onClose} aria-label="Close calendar" style={{ width: 34, height: 34, borderRadius: 8, background: "var(--line-soft)", fontSize: 20, flexShrink: 0 }}>×</button>
        </div>

        {error && (
          <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--red-wash)", color: "var(--red)", border: "2px solid var(--red)", fontSize: 14, fontWeight: 600 }}>
            Couldn't load this week ({error}). <button onClick={retry} style={{ color: "var(--link)", fontWeight: 700, textDecoration: "underline" }}>Try again</button>
          </div>
        )}

        <WeekCalendar weekStart={weekStart} onWeekChange={setWeekStart} events={[...events, ...mine]} loading={loading} noPast
          selection={sel ? { ...sel, clash: clash.length > 0 } : null} onSelect={(key, s, e) => setSel({ key, start: s, end: e })}
          maxHeight={phone ? 360 : 500} />
        <CalendarLegend />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div aria-live="polite" style={{ minWidth: 0, flex: "1 1 260px" }}>
            {!sel ? <span style={{ color: "var(--ink-faint)", fontSize: 15 }}>Nothing selected yet.</span> : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{label(sel.key)} · {fmt12(sel.start)} – {fmt12(sel.end)}</div>
                {clash.length > 0 && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--red)", marginTop: 2 }}>
                    This overlaps {clash.slice(0, 2).map(c => c.title).join(" and ")}{clash.length > 2 ? ` and ${clash.length - 2} more` : ""}. You can still use it and join the waitlist.
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "11px 18px", borderRadius: 10, fontSize: 15.5, fontWeight: 700, border: "2px solid var(--ink)", background: "var(--card)", color: "var(--ink)" }}>Cancel</button>
            <button disabled={!sel} onClick={() => onPick(sel)} style={{ padding: "11px 18px", borderRadius: 10, fontSize: 15.5, fontWeight: 700, color: "var(--ink)", background: sel ? "var(--blue)" : "var(--line-soft)" }}>Use this time</button>
          </div>
        </div>
      </div>
    </div>
  );
}
