import { useEffect, useRef, useState } from 'react';
import { LIVE, roomSchedule } from './api.js';
import { slotState } from './data/mock.js';
import { KINDS, dayKey, addDays } from './components/WeekCalendar.jsx';

// One item from GET /rooms/{id}/schedule -> a calendar block.
// start/end is the event itself; blockedStart/blockedEnd also covers setup and cleanup (used for clashes).
export function scheduleToEvents(items) {
  return items.map((it, i) => {
    const kind = it.kind === "closed" ? "closed"
      : it.kind === "waitlist" ? "waitlist"
      : it.source === "25live" ? "booked"
      : it.status === "approved" ? "approved"
      : it.status === "pending" ? "pending"
      : "booked";
    const start = new Date(it.event_start || it.start), end = new Date(it.event_end || it.end);
    return {
      id: `${it.request_id || "x"}-${i}-${it.start}`,
      start, end, blockedStart: new Date(it.start), blockedEnd: new Date(it.end),
      title: it.name || KINDS[kind].label,
      sub: kind === "waitlist" && it.waitlist_position ? `Waitlist #${it.waitlist_position}` : KINDS[kind].label,
      kind,
    };
  });
}

// Demo mode (no server): the same made-up availability the booking drawer uses, as blocks.
export function mockEventsForWeek(room, weekStart) {
  const out = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(weekStart, d), key = dayKey(day);
    let run = null;
    const close = () => { if (run) { out.push(run); run = null; } };
    for (let h = 9; h <= 20; h++) {
      const st = slotState(room, key, `${h}:00`);
      if (st === "open") { close(); continue; }
      const kind = st === "taken" ? "booked" : "pending";
      if (run && run.kind === kind) { run.end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 1); run.blockedEnd = run.end; continue; }
      close();
      const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h), e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 1);
      run = { id: `${key}-${h}`, start: s, end: e, blockedStart: s, blockedEnd: e, kind,
        title: kind === "booked" ? "Booked" : "Requested by another club", sub: KINDS[kind].label };
    }
    close();
  }
  return out;
}

// The calendar blocks for one room and one week. Live: loaded from the server (and remembered).
export function useRoomWeek(room, weekStart) {
  const cache = useRef(new Map());
  const [, force] = useState(0);
  const [st, setSt] = useState({ loading: false, error: "" });
  const live = !!room && LIVE && !!room.live;
  const key = room ? `${room.id}|${dayKey(weekStart)}` : "";
  const retry = useRef(0);
  useEffect(() => {
    if (!live) { setSt({ loading: false, error: "" }); return; }
    if (cache.current.has(key)) { setSt({ loading: false, error: "" }); return; }
    let off = false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = addDays(weekStart, 6);
    if (last < today) { cache.current.set(key, []); force(n => n + 1); return; }
    const first = weekStart < today ? today : weekStart;   // days that are over aren't loaded
    setSt({ loading: true, error: "" });
    roomSchedule(room.id, dayKey(first), dayKey(last))
      .then(items => { cache.current.set(key, scheduleToEvents(items)); if (!off) { setSt({ loading: false, error: "" }); force(n => n + 1); } })
      .catch(e => { if (!off) setSt({ loading: false, error: e.message || "Couldn't load this room's schedule." }); });
    return () => { off = true; };
  }, [key, live, retry.current]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = !room ? [] : live ? (cache.current.get(key) || []) : mockEventsForWeek(room, weekStart);
  return { events, loading: st.loading, error: st.error, retry: () => { retry.current += 1; force(n => n + 1); } };
}
