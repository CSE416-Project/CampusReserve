import { useMemo, useState } from 'react';
import { ROOMS, upcomingEvents } from '../data/mock.js';
import Pill from '../components/Pill.jsx';
import WeekCalendar, { CalendarLegend, startOfWeek } from '../components/WeekCalendar.jsx';
import { useRoomWeek } from '../calendarData.js';

const ALL = "All buildings";
const PAGE = 25;   // rooms shown per building before "Show more"

const field = { padding:"9px 12px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", outline:"none", maxWidth:"100%" };
const chip = on => ({ padding:"7px 13px", borderRadius:999, fontSize:14, fontWeight:700, border:"2px solid var(--ink)", color:"var(--ink)",
  background: on ? "var(--blue)" : "var(--card)" });

let saved = null;
try { saved = localStorage.getItem("cr_rooms_view"); } catch { /* storage unavailable */ }

// Admin > Rooms. Two views of the same rooms: a list grouped by building, or a week calendar.
// Connected to the server it shows the real rooms and requests; without one, the demo data.
export default function RoomsAdmin({ rooms, requests = [], loading = false }) {
  const live = !!rooms && rooms.some(r => r.live);
  const roomList = live ? rooms : ROOMS;

  const [view, setViewState] = useState(saved === "calendar" ? "calendar" : "list");
  const setView = v => { setViewState(v); try { localStorage.setItem("cr_rooms_view", v); } catch { /* ignore */ } };
  const [q, setQ] = useState("");
  const [building, setBuilding] = useState(ALL);
  const [bookable, setBookable] = useState("all");   // all | open | closed
  const buildings = useMemo(() => [...new Set(roomList.map(r => r.building))].sort(), [roomList]);

  const filtered = useMemo(() => roomList.filter(r =>
    (building === ALL || r.building === building) &&
    (bookable === "all" || (bookable === "closed") === !!r.closed) &&
    (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()) || r.building.toLowerCase().includes(q.trim().toLowerCase()))
  ), [roomList, building, bookable, q]);
  const filtersActive = !!q.trim() || building !== ALL || bookable !== "all";

  // Upcoming bookings per room (live: from the requests; demo: the sample events).
  const eventsByRoom = useMemo(() => {
    const m = new Map();
    if (live) {
      for (const r of requests) {
        if (!r.room || (r.status !== "approved" && r.status !== "pending")) continue;
        if (r.endAt && r.endAt < new Date()) continue;
        if (!m.has(r.room.id)) m.set(r.room.id, []);
        m.get(r.room.id).push({ org: r.org, title: r.event || "Booking", date: r.date, time: r.time, status: r.status, at: r.startAt });
      }
      for (const list of m.values()) list.sort((a, b) => (a.at || 0) - (b.at || 0));
    }
    return m;
  }, [live, requests]);
  const eventsFor = r => live ? (eventsByRoom.get(r.id) || []) : upcomingEvents(r);

  const pendingCount = live ? requests.filter(r => r.status === "pending").length : 0;
  const upcomingTotal = filtered.reduce((n, r) => n + eventsFor(r).length, 0);

  return (
    <main className="page" style={{ maxWidth:1100, margin:"0 auto", padding:"26px 24px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, marginBottom:4 }}>Rooms</h1>
          <div style={{ fontSize:14.5, color:"var(--ink-faint)" }} aria-live="polite">
            {loading ? "Loading rooms…" : `${filtered.length} room${filtered.length === 1 ? "" : "s"} · ${new Set(filtered.map(r => r.building)).size} building${new Set(filtered.map(r => r.building)).size === 1 ? "" : "s"}`
              + (view === "list" ? ` · ${upcomingTotal} upcoming booking${upcomingTotal === 1 ? "" : "s"}` : "")
              + (pendingCount ? ` · ${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting for review` : "")}
          </div>
        </div>
        <div role="group" aria-label="View" style={{ display:"inline-flex", border:"2px solid var(--ink)", borderRadius:10, overflow:"hidden", background:"var(--card)" }}>
          {[["list", "☰  List"], ["calendar", "📅  Calendar"]].map(([v, text]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              style={{ padding:"9px 16px", fontSize:14.5, fontWeight:700, color:"var(--ink)", background: view === v ? "var(--blue)" : "var(--card)", borderRadius:0, boxShadow:"none", border:"none" }}>{text}</button>
          ))}
        </div>
      </div>

      {/* filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:18 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search rooms or buildings" aria-label="Search rooms" style={{ ...field, flex:"1 1 220px", minWidth:0 }} />
        <select value={building} onChange={e => setBuilding(e.target.value)} aria-label="Building" style={field}>
          <option>{ALL}</option>
          {buildings.map(b => <option key={b}>{b}</option>)}
        </select>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }} role="group" aria-label="Bookable">
          {[["all", "All"], ["open", "Bookable"], ["closed", "Not bookable"]].map(([v, text]) => (
            <button key={v} onClick={() => setBookable(v)} aria-pressed={bookable === v} style={chip(bookable === v)}>{text}</button>
          ))}
        </div>
        {filtersActive && <button onClick={() => { setQ(""); setBuilding(ALL); setBookable("all"); }} style={{ fontSize:14, fontWeight:700, color:"var(--link)", textDecoration:"underline" }}>Clear filters</button>}
      </div>

      {loading ? <div style={{ color:"var(--ink-faint)" }}>Loading rooms…</div>
        : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)", borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No rooms match those filters.</div>
        ) : view === "list"
          ? <RoomList rooms={filtered} eventsFor={eventsFor} filtersActive={filtersActive} />
          : <RoomCalendar rooms={filtered} requests={requests} live={live} />}
    </main>
  );
}

// ---------------------------------------------------------------- list view

function RoomList({ rooms, eventsFor, filtersActive }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rooms) { if (!m.has(r.building)) m.set(r.building, []); m.get(r.building).push(r); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([building, list]) => ({ building, rooms: list }));
  }, [rooms]);
  const [open, setOpen] = useState({});              // building -> true/false once the admin has toggled it
  const [more, setMore] = useState({});              // building -> how many rooms are shown
  const [expanded, setExpanded] = useState(null);    // the room whose bookings are open
  const autoOpen = filtersActive || groups.length <= 3 || rooms.length <= 30;
  const isOpen = b => open[b] ?? autoOpen;
  const setAll = v => setOpen(Object.fromEntries(groups.map(g => [g.building, v])));

  return (
    <div>
      {groups.length > 1 && (
        <div style={{ display:"flex", gap:14, justifyContent:"flex-end", marginBottom:8 }}>
          <button onClick={() => setAll(true)} style={{ fontSize:14, fontWeight:700, color:"var(--link)" }}>Expand all</button>
          <button onClick={() => setAll(false)} style={{ fontSize:14, fontWeight:700, color:"var(--link)" }}>Collapse all</button>
        </div>
      )}
      <div style={{ display:"grid", gap:14 }}>
        {groups.map(g => {
          const o = isOpen(g.building), shown = g.rooms.slice(0, more[g.building] || PAGE);
          const bookings = g.rooms.reduce((n, r) => n + eventsFor(r).length, 0);
          return (
            <section key={g.building} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, boxShadow:"var(--shadow)", overflow:"hidden" }}>
              <button onClick={() => setOpen(s => ({ ...s, [g.building]: !o }))} aria-expanded={o}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"14px 18px", textAlign:"left", background: o ? "var(--blue-wash)" : "var(--card)", borderRadius:0 }}>
                <span aria-hidden="true" style={{ fontSize:14, width:14, color:"var(--ink-soft)" }}>{o ? "▾" : "▸"}</span>
                <span style={{ fontSize:17, fontWeight:800, flex:1, minWidth:0 }}>{g.building}</span>
                <span style={{ fontSize:13.5, fontWeight:600, color:"var(--ink-soft)", whiteSpace:"nowrap" }}>
                  {g.rooms.length} room{g.rooms.length === 1 ? "" : "s"}{bookings ? ` · ${bookings} upcoming` : ""}
                </span>
              </button>
              {o && (
                <div>
                  {shown.map(r => <RoomRow key={r.id} room={r} events={eventsFor(r)} open={expanded === r.id} onToggle={() => setExpanded(e => e === r.id ? null : r.id)} />)}
                  {g.rooms.length > shown.length && (
                    <button onClick={() => setMore(m => ({ ...m, [g.building]: (m[g.building] || PAGE) + PAGE }))}
                      style={{ width:"100%", padding:"12px", fontSize:14.5, fontWeight:700, color:"var(--link)", borderTop:"1px solid var(--line)", borderRadius:0 }}>
                      Show more ({g.rooms.length - shown.length} more)
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoomRow({ room: r, events, open, onToggle }) {
  const next = events[0];
  return (
    <div style={{ borderTop:"1px solid var(--line)" }}>
      <button onClick={onToggle} aria-expanded={open} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", padding:"12px 18px", textAlign:"left", borderRadius:0, background: open ? "var(--paper)" : "transparent" }}>
        <div style={{ flex:"1 1 220px", minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15.5 }}>{r.name}</div>
          <div style={{ fontSize:13.5, color:"var(--ink-faint)" }}>Holds {r.cap} · {r.type}</div>
        </div>
        <div style={{ flex:"1 1 200px", minWidth:0, fontSize:13.5, color:"var(--ink-soft)" }}>
          {next ? <><b>{events.length} upcoming</b><div style={{ color:"var(--ink-faint)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Next: {next.org || next.title} · {next.date} · {next.time}</div></>
            : <span style={{ color:"var(--ink-faint)" }}>No upcoming bookings</span>}
        </div>
        <Pill status={r.status} small />
        <span aria-hidden="true" style={{ fontSize:13, color:"var(--ink-soft)", width:12 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding:"4px 18px 16px" }}>
          {r.features?.length > 0 && <div style={{ fontSize:13, color:"var(--ink-faint)", marginBottom:8 }}>{r.features.slice(0, 8).join(" · ")}{r.features.length > 8 ? ` · +${r.features.length - 8} more` : ""}</div>}
          {events.length === 0 ? <div style={{ fontSize:14, color:"var(--ink-faint)" }}>Nothing booked or requested yet.</div> : (
            <div style={{ display:"grid", gap:5 }}>
              {events.slice(0, 6).map((e, i) => (
                <div key={i} style={{ fontSize:13.5, color:"var(--ink-soft)", background:"var(--paper)", borderRadius:8, padding:"7px 11px", display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                  <span><b>{e.org}</b>{e.org ? " · " : ""}{e.title} · {e.date} · {e.time}</span>
                  {e.status && <span style={{ fontWeight:700, color: e.status === "approved" ? "var(--green)" : "var(--amber)" }}>{e.status === "approved" ? "Approved" : "Pending"}</span>}
                </div>
              ))}
              {events.length > 6 && <div style={{ fontSize:13, color:"var(--ink-faint)" }}>+ {events.length - 6} more. See them on the Calendar view.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- calendar view

const ALL_ROOMS = "__all";

function RoomCalendar({ rooms, requests, live }) {
  const [pick, setPick] = useState(live ? ALL_ROOMS : String(rooms[0].id));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // keep the choice valid if the filters above remove the chosen room
  const room = pick === ALL_ROOMS ? null : rooms.find(r => String(r.id) === pick) || null;
  const effective = pick === ALL_ROOMS && live ? ALL_ROOMS : (room ? String(room.id) : String(rooms[0].id));
  const chosen = effective === ALL_ROOMS ? null : (room || rooms[0]);
  const { events: roomEvents, loading, error, retry } = useRoomWeek(chosen, weekStart);

  const byBuilding = useMemo(() => {
    const m = new Map();
    for (const r of rooms) { if (!m.has(r.building)) m.set(r.building, []); m.get(r.building).push(r); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rooms]);
  const visibleIds = useMemo(() => new Set(rooms.map(r => r.id)), [rooms]);

  // "All rooms": the club requests for the rooms shown, from the requests the admin already has.
  const requestEvents = useMemo(() => requests
    .filter(r => r.startAt && r.room && visibleIds.has(r.room.id) && ["approved", "pending", "waitlisted"].includes(r.status))
    .map(r => ({ id: r.id, start: r.startAt, end: r.endAt, title: r.room.name, sub: [r.org, r.event].filter(Boolean).join(" · "),
      kind: r.status === "approved" ? "approved" : r.status === "waitlisted" ? "waitlist" : "pending" })), [requests, visibleIds]);

  const events = chosen ? roomEvents : requestEvents;

  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:12 }}>
        <label style={{ fontSize:14, fontWeight:700, color:"var(--ink-soft)" }}>Room{" "}
          <select value={effective} onChange={e => setPick(e.target.value)} style={{ ...field, marginLeft:6, maxWidth:"min(420px, 80vw)" }}>
            {live && <option value={ALL_ROOMS}>All rooms · club requests</option>}
            {byBuilding.map(([b, list]) => (
              <optgroup key={b} label={b}>{list.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <span style={{ fontSize:13.5, color:"var(--ink-faint)" }}>
          {chosen ? `${chosen.building} · holds ${chosen.cap}` : "Shows club requests only. Pick one room to also see 25Live bookings and closures."}
        </span>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom:12, padding:"10px 14px", borderRadius:10, background:"var(--red-wash)", color:"var(--red)", border:"2px solid var(--red)", fontSize:14, fontWeight:600 }}>
          Couldn't load this room's schedule ({error}). <button onClick={retry} style={{ color:"var(--link)", fontWeight:700, textDecoration:"underline" }}>Try again</button>
        </div>
      )}
      <WeekCalendar weekStart={weekStart} onWeekChange={setWeekStart} events={events} loading={chosen ? loading : false} maxHeight={600} />
      <CalendarLegend kinds={chosen ? ["booked", "approved", "pending", "waitlist", "closed"] : ["approved", "pending", "waitlist"]} />
      {!chosen && events.length === 0 && <div style={{ marginTop:12, fontSize:14, color:"var(--ink-faint)" }}>No club requests to show. Use the arrows to look at other weeks.</div>}
    </div>
  );
}
