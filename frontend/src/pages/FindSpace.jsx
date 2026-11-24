import { useState, useMemo, useEffect, useRef } from 'react';
import { STATUS } from '../status.js';
import Pill from '../components/Pill.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import Feature from '../components/Feature.jsx';
import RoomPhoto from '../components/RoomPhoto.jsx';
import { LIVE, availableSlots } from '../api.js';
import MultiDayPicker from '../components/MultiDayPicker.jsx';
import TimeWindowsEditor from '../components/TimeWindowsEditor.jsx';
import { MAX_SLOTS, buildSlots, dayKey, fmtDay, fmtWindow, prefillFor } from '../availability.js';
import useDialog from '../a11y/useDialog.js';
import { useIsPhone, useScrollLock } from '../useMedia.js';

const PAGE_SIZE = 10;
const ALL_BUILDINGS = "All buildings";   // the "no building filter" option
const ANY_TYPE = "Any type";             // the "no type filter" option
// "Meeting Room", "meeting room" and "Meeting  room " are the same option: compare by this key.
const norm = v => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
// One option per key. The label is the spelling used most often (ties go to the one that starts with a capital).
const uniqSorted = list => {
  const byKey = new Map();
  for (const v of list) {
    const k = norm(v); if (!k) continue;
    const label = String(v).trim().replace(/\s+/g, " ");
    const counts = byKey.get(k) || new Map();
    counts.set(label, (counts.get(label) || 0) + 1);
    byKey.set(k, counts);
  }
  const pick = counts => [...counts].sort((a, b) => b[1] - a[1] || (/^[A-Z]/.test(b[0]) - /^[A-Z]/.test(a[0])))[0][0];
  return [...byKey.values()].map(pick).sort((a, b) => a.localeCompare(b, undefined, { sensitivity:"base" }));
};

export default function FindSpace({ onView, onBook, rooms = [], loading = false }) {
  // Dropdown and feature options come from the rooms we were given (live rooms, or App's mock rooms when not live).
  const buildings = useMemo(()=> [ALL_BUILDINGS, ...uniqSorted(rooms.map(r=>r.building))],[rooms]);
  const types = useMemo(()=> [ANY_TYPE, ...uniqSorted(rooms.map(r=>r.type))],[rooms]);
  const allFeatures = useMemo(()=> uniqSorted(rooms.flatMap(r=>r.features || [])),[rooms]);
  const [q,setQ]=useState(""); const [building,setBuilding]=useState(ALL_BUILDINGS); const [type,setType]=useState(ANY_TYPE);
  const [minCap,setMinCap]=useState(0);
  // "Available on" filter (live mode only): any number of days and any number of time windows.
  // Every day is checked against every window; each pair is a "slot".
  const [dates,setDates]=useState([]);
  const [windows,setWindows]=useState([{ id:1, from:"", to:"" }]);
  const [mode,setMode]=useState("all");   // "all": free at every slot, "any": free at one or more
  const [showTaken,setShowTaken]=useState(false);
  const todayStr = dayKey(new Date());
  const { slots, tooMany, combos, dayCount, timeCount } = useMemo(()=>buildSlots(dates, windows), [dates, windows]);
  const total = slots.length;
  const timeSet = LIVE && total > 0 && !tooMany;
  const slotsKey = slots.map(x=>x.key).join(",");
  const [avail,setAvail]=useState({ map:null, loading:false, error:"" });
  useEffect(() => {
    if (!timeSet) { setAvail({ map:null, loading:false, error:"" }); return; }
    let off = false;
    setAvail({ map:null, loading:true, error:"" });
    availableSlots({ dates:[...new Set(slots.map(x=>x.date))], windows:[...new Map(slots.map(x=>[`${x.from}-${x.to}`, { from:x.from, to:x.to }])).values()] })
      .then(list => { if (!off) setAvail({ map:new Map(list.map(r => [String(r.id), { free:new Set(r.free_slots || []), pending:new Set(r.pending_slots || []) }])), loading:false, error:"" }); })
      .catch(e => { if (!off) setAvail({ map:null, loading:false, error:e.message }); });
    return () => { off = true; };
  }, [timeSet, slotsKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  // How many of the picked slots a room is free for. "clean" leaves out slots where another club has a pending request.
  const slotStat = r => { const i = avail.map && avail.map.get(String(r.id)); const free = i ? i.free.size : 0; return { info:i, free, clean:free - (i ? i.pending.size : 0) }; };
  // null = a match. booked = not free at any slot; requested = free, but another club has asked for it; partial = free at some slots only.
  const takenKind = r => {
    if (!avail.map) return null;
    const { free, clean } = slotStat(r);
    if (mode === "all" ? clean === total : clean > 0) return null;
    return free === 0 ? "booked" : clean === 0 ? "requested" : "partial";
  };
  const [picked,setPicked]=useState([]); const [fq,setFq]=useState("");
  const [page,setPage]=useState(1);
  const toggle = f => setPicked(p => p.includes(f) ? p.filter(x=>x!==f) : [...p,f]);
  const hasFeature = (r, f) => (r.features || []).some(x => norm(x) === norm(f));
  const shownFeatures = allFeatures.filter(f => f.toLowerCase().includes(fq.toLowerCase()));

  const filtered = useMemo(()=>rooms.filter(r=>{
    if (q && !`${r.name} ${r.building}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (building!==ALL_BUILDINGS && norm(r.building)!==norm(building)) return false;
    if (type!==ANY_TYPE && norm(r.type)!==norm(type)) return false;
    if (minCap && r.cap < minCap) return false;
    if (!picked.every(f => hasFeature(r, f))) return false;
    if (avail.map && (takenKind(r) || r.closed) && !showTaken) return false;
    return true;
  }).map((r,i)=>({ r, i })).sort((a,b)=> avail.map && total > 1 ? slotStat(b.r).clean - slotStat(a.r).clean || a.i - b.i : a.i - b.i).map(x=>x.r),   // with several slots, the best match first
  [rooms,q,building,type,minCap,picked,avail.map,showTaken,mode]);

  // Back to page 1 whenever the filters (or the room list) change.
  useEffect(() => setPage(1), [rooms,q,building,type,minCap,picked,avail.map,showTaken,mode]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // Phones: filters live in a full-screen sheet opened from the Filters button.
  const isPhone = useIsPhone();
  const [sheet,setSheet]=useState(false);
  const sheetOpen = isPhone && sheet;
  const panel = useRef(null);
  useDialog(panel, { open: sheetOpen, onClose: () => setSheet(false) });
  useScrollLock(sheetOpen);
  const activeFilters = (building!==ALL_BUILDINGS) + (type!==ANY_TYPE) + (minCap>0) + picked.length + (dates.length>0 || windows.some(w=>w.from||w.to) ? 1 : 0) + (showTaken ? 1 : 0);
  // Reset search: every field back to how the page starts.
  const searchUsed = activeFilters > 0 || q !== "" || fq !== "";
  const resetAll = () => {
    setQ(""); setBuilding(ALL_BUILDINGS); setType(ANY_TYPE); setMinCap(0);
    setPicked([]); setFq(""); setDates([]); setWindows([{ id:1, from:"", to:"" }]); setMode("all"); setShowTaken(false);
  };

  // The label on a room card for the picked days and times (nothing for a plain match on one slot).
  const slotBadge = r => {
    const kind = takenKind(r), { clean } = slotStat(r), many = total > 1;
    if (kind === "booked") return { text: many ? "Booked at all of these times" : "Booked at this time", bg:"var(--red-wash)", fg:"var(--red)" };
    if (kind === "requested") return { text: many ? "Requested at these times" : "Requested at this time", bg:"var(--amber-wash)", fg:"var(--ink)" };
    if (!many) return null;
    return clean === total ? { text:`Free at all ${total} times`, bg:"var(--green-wash)", fg:"var(--green)" }
                           : { text:`Free at ${clean} of ${total} times`, bg:"var(--amber-wash)", fg:"var(--ink)" };
  };
  // What the booking window starts with. "Every time": all the picked days. "Any time": the first slot that works.
  const bookable = r => {
    if (!timeSet) return r;
    if (mode === "any" && total > 1) {
      const { info } = slotStat(r);
      const first = slots.find(x => info && info.free.has(x.key) && !info.pending.has(x.key)) || slots.find(x => info && info.free.has(x.key)) || slots[0];
      return { ...r, prefill:prefillFor([first]) };
    }
    return { ...r, prefill:prefillFor(slots) };
  };

  const goTo = p => { setPage(p); window.scrollTo({ top:0, behavior:"smooth" }); };
  const pageBtn = disabled => ({ padding:"8px 14px", borderRadius:8, fontSize:14, fontWeight:600, border:"2px solid var(--ink)",
    color:"var(--ink)", background: disabled ? "var(--paper)" : "var(--blue)", opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer" });

  return (
    <main className="page" style={{ maxWidth:1400, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>{onBook ? "Find a space to book" : "Find a space"}</h1>
      <div className="filters-bar">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search rooms or buildings" aria-label="Search rooms or buildings" />
        <button className="filters-btn" onClick={()=>setSheet(true)} data-on={activeFilters>0 || undefined} aria-haspopup="dialog">
          Filters{activeFilters>0 && ` (${activeFilters})`}
        </button>
      </div>
      <div className="filters-layout" style={{ display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" }}>
        <aside ref={panel} className={`filters-panel${sheetOpen ? " open" : ""}`}
          {...(sheetOpen ? { role:"dialog", "aria-modal":true, "aria-labelledby":"fs-filters-title", tabIndex:-1 } : {})}
          style={{ width:340, flexShrink:0, position:"sticky", top:80, background:"var(--card)", border:"2px solid var(--ink)",
          borderRadius:14, padding:18, boxShadow:"var(--shadow)" }}>
          <div className="sheet-head">
            <h2 id="fs-filters-title" style={{ fontSize:20 }}>Filters</h2>
            {searchUsed && <button onClick={resetAll} style={{ fontSize:15, fontWeight:700, color:"var(--link)" }}>Reset search</button>}
          </div>
          <div className="hide-phone" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h2 style={{ fontSize:18 }}>Filters</h2>
            <button onClick={resetAll} disabled={!searchUsed} aria-label="Reset search: clear all fields and filters"
              style={{ padding:"6px 12px", borderRadius:8, fontSize:13.5, fontWeight:700, border:"2px solid var(--ink)",
              color:"var(--ink)", background:"var(--card)" }}>↺ Reset search</button>
          </div>
          <div className="hide-phone">
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or building"
            style={{ width:"100%", margin:"6px 0 14px", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
            borderRadius:8, background:"var(--paper)", outline:"none" }} />
          </div>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Building</label>
          <select value={building} onChange={e=>setBuilding(e.target.value)} style={{ width:"100%", margin:"6px 0 14px",
            padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)" }}>
            {buildings.map(o=><option key={o}>{o}</option>)}
          </select>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Space type</label>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ width:"100%", margin:"6px 0 14px",
            padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)" }}>
            {types.map(o=><option key={o}>{o}</option>)}
          </select>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Minimum capacity</label>
          <input type="number" min="0" placeholder="e.g. 20" value={minCap===0?"":minCap}
            onChange={e=>setMinCap(e.target.value === "" ? 0 : Math.max(0, +e.target.value))}
            style={{ width:"100%", margin:"6px 0 4px", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
            borderRadius:8, background:"var(--paper)", outline:"none" }} />

          {LIVE && (
            <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid var(--line)" }}>
              <div style={{ fontSize:15, fontWeight:700 }}>Available on</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)", margin:"2px 0 10px" }}>Pick as many days and times as you need. We check every day at every time.</div>

              <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Days</label>
              <MultiDayPicker value={dates} onChange={setDates} min={todayStr} />

              <div style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)", margin:"16px 0 6px" }}>Times</div>
              <TimeWindowsEditor windows={windows} onChange={setWindows} />

              {tooMany && <div role="alert" style={{ fontSize:13.5, color:"var(--red)", fontWeight:600, marginTop:10 }}>
                Too many to search: {dayCount} day{dayCount===1?"":"s"} × {timeCount} time{timeCount===1?"":"s"} = {combos}. Remove some days or times to search (the limit is {MAX_SLOTS}).</div>}
              {avail.error && <div role="alert" style={{ fontSize:13.5, color:"var(--red)", fontWeight:600, marginTop:10 }}>{avail.error}</div>}
              {!timeSet && !tooMany && <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:10 }}>
                {dates.length === 0 && total === 0 ? "Pick at least one day and a start and end time to see only the rooms that are free." : dates.length === 0 ? "Pick at least one day." : "Fill in a start and end time."}</div>}

              {total > 1 && (
                <div style={{ marginTop:14 }}>
                  <div id="fs-match-label" style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)", marginBottom:6 }}>
                    {total} day-and-time combinations. Show rooms that are free…</div>
                  <div role="group" aria-labelledby="fs-match-label" style={{ display:"flex", gap:8 }}>
                    {[["all","At every time"],["any","At any time"]].map(([v,label]) => (
                      <button key={v} type="button" aria-pressed={mode===v} onClick={()=>setMode(v)}
                        style={{ flex:1, padding:"8px 6px", borderRadius:8, fontSize:14, fontWeight:700, color:"var(--ink)",
                        border:"2px solid var(--ink)", background: mode===v ? "var(--blue)" : "var(--card)" }}>{label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:6 }}>
                    {mode==="all" ? "Only rooms you could use for all of them, like a weekly meeting." : "Rooms free for at least one of them, best matches first. Good when you're flexible."}</div>
                </div>
              )}

              <label style={{ display:"flex", alignItems:"flex-start", gap:9, fontSize:14, cursor:"pointer", marginTop:14 }}>
                <input type="checkbox" checked={showTaken} onChange={e=>setShowTaken(e.target.checked)} style={{ marginTop:3, accentColor:"var(--blue)" }} />
                <span>Also show rooms that are booked or requested {total > 1 ? "at some of these times" : "then"}{onBook ? " (you can join their waitlist)" : ""}</span>
              </label>
              {(dates.length>0 || windows.some(w=>w.from||w.to)) && <button onClick={()=>{ setDates([]); setWindows([{ id:1, from:"", to:"" }]); setMode("all"); }}
                style={{ fontSize:13, fontWeight:600, color:"var(--link)", marginTop:8 }}>Clear days and times</button>}
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", margin:"18px 0 6px" }}>
            <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>
              Features{picked.length>0 && ` (${picked.length} selected)`}
            </label>
            {picked.length>0 && <button onClick={()=>setPicked([])} style={{ fontSize:13, fontWeight:600, color:"var(--link)" }}>Clear</button>}
          </div>
          <input value={fq} onChange={e=>setFq(e.target.value)} placeholder="Search features"
            style={{ width:"100%", marginBottom:8, padding:"8px 11px", fontSize:14, border:"2px solid var(--ink)",
            borderRadius:8, background:"var(--paper)", outline:"none" }} />
          <div className="feature-list" style={{ maxHeight:"calc(100vh - 520px)", minHeight:220, overflowY:"auto", border:"2px solid var(--ink)",
            borderRadius:8, padding:"4px 10px", background:"var(--paper)" }}>
            {shownFeatures.map(ft => (
              <label key={ft} style={{ display:"flex", alignItems:"flex-start", gap:9, padding:"6px 0", fontSize:14, cursor:"pointer" }}>
                <input type="checkbox" checked={picked.includes(ft)} onChange={()=>toggle(ft)} style={{ marginTop:3, accentColor:"var(--blue)" }} />
                <span>{ft}</span>
              </label>
            ))}
            {shownFeatures.length===0 && <div style={{ padding:"10px 0", fontSize:14, color:"var(--ink-faint)" }}>No matching features</div>}
          </div>
          <div className="sheet-foot">
            <button onClick={()=>setSheet(false)} style={{ background:"var(--blue)" }}>
              Show {filtered.length} space{filtered.length===1?"":"s"}
            </button>
          </div>
        </aside>

        <div style={{ flex:1, minWidth:280, display:"grid", gap:14 }}>
          {loading && <LoadingScreen inline label="Loading spaces from 25Live…" />}
          {!loading && avail.loading && <LoadingScreen inline label="Checking which rooms are free…" />}
          {!loading && !avail.loading && filtered.length===0 && <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)",
            background:"var(--card)", borderRadius:14, border:"2px dashed var(--ink-faint)" }}>
            <div>{avail.map ? (total > 1
              ? `No spaces are free ${mode==="all" ? "at every one of those times" : "at any of those times"}.${mode==="all" ? " Try \"At any time\", fewer days or times," : " Try other days or times,"} or tick the box to see ${onBook ? "booked rooms you can waitlist" : "the booked rooms too"}.`
              : (onBook ? "No spaces are free then. Try another time, or tick the box to see booked rooms you can waitlist." : "No spaces are free then. Try another time, or tick the box to see the booked rooms too.")) : "No spaces match those filters."}</div>
            {searchUsed && <button onClick={resetAll} style={{ marginTop:12, padding:"8px 16px", borderRadius:8, fontSize:14, fontWeight:700,
              color:"var(--ink)", background:"var(--blue)" }}>Reset search</button>}
          </div>}
          {!loading && !avail.loading && filtered.length>0 && (
            <div style={{ fontSize:14, color:"var(--ink-faint)" }}>
              Showing {(current-1)*PAGE_SIZE+1}–{Math.min(current*PAGE_SIZE, filtered.length)} of {filtered.length} spaces
            </div>
          )}
          {!avail.loading && shown.map(r => (
            <div key={r.id} className="room-card" onClick={()=>!r.closed && onView(r)} style={{ display:"flex", gap:18, flexWrap:"wrap", background:"var(--card)", border:"2px solid var(--ink)",
              borderRadius:14, padding:18, boxShadow:"var(--shadow)", opacity:r.closed?0.65:1, cursor:r.closed?"default":"pointer",
              borderLeft:`4px solid ${STATUS[r.status].fg}` }}>
              <div className="room-card-photo" style={{ width:200, flexShrink:0 }}><RoomPhoto room={r} /></div>
              <div className="room-card-body" style={{ flex:1, minWidth:240 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div>
                  <h3 style={{ fontSize:18, fontWeight:700 }}>{r.name}</h3>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{r.building} · Holds {r.cap} · {r.type}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  <Pill status={r.status} />
                  {avail.map && (() => { const b = slotBadge(r); return b && <span style={{ fontSize:12.5, fontWeight:700, padding:"3px 9px", borderRadius:999, background:b.bg, color:b.fg }}>{b.text}</span>; })()}
                </div>
              </div>
              {avail.map && total > 1 && <SlotBreakdown slots={slots} info={slotStat(r).info} />}
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, margin:"12px 0" }}>
                {r.features.slice(0,5).map(f=><Feature key={f}>{f}</Feature>)}
                {r.features.length>5 && <Feature>+{r.features.length-5} more</Feature>}
              </div>
              <div style={{ fontSize:14, color:r.closed?"var(--slate)":"var(--ink-soft)", background:r.closed?"var(--slate-wash)":"var(--paper)",
                padding:"8px 11px", borderRadius:8, marginBottom:12 }}>{r.note}</div>
              {!r.closed && (
                <div className="room-card-actions" style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <span style={{ fontSize:14.5, fontWeight:600, color:"var(--link)" }}>View room details ›</span>
                  {onBook && <button onClick={e=>{ e.stopPropagation(); onBook(bookable(r)); }} style={{ marginLeft:"auto", padding:"8px 16px",
                    borderRadius:8, fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--blue)" }}>{["booked","requested"].includes(takenKind(r)) ? "Join waitlist" : "Book"}</button>}
                </div>
              )}
              </div>
            </div>
          ))}
          {pageCount > 1 && !avail.loading && (
            <nav aria-label="Room pages" style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:12, marginTop:6 }}>
              <button onClick={()=>goTo(current-1)} disabled={current===1} style={pageBtn(current===1)}>‹ Previous</button>
              <span style={{ fontSize:14, fontWeight:600 }} aria-current="page">Page {current} of {pageCount}</span>
              <button onClick={()=>goTo(current+1)} disabled={current===pageCount} style={pageBtn(current===pageCount)}>Next ›</button>
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

// "See which times": for each picked day, which time windows a room is free for.
function SlotBreakdown({ slots, info }) {
  const days = [...new Set(slots.map(x=>x.date))];
  const state = x => !info || !info.free.has(x.key) ? "booked" : info.pending.has(x.key) ? "requested" : "free";
  const look = { free:{ mark:"✓", word:"free", bg:"var(--green-wash)", fg:"var(--green)" },
                 requested:{ mark:"!", word:"requested by another club", bg:"var(--amber-wash)", fg:"var(--ink)" },
                 booked:{ mark:"✕", word:"taken", bg:"var(--red-wash)", fg:"var(--red)" } };
  return (
    <details onClick={e=>e.stopPropagation()} style={{ marginTop:10 }}>
      <summary style={{ cursor:"pointer", fontSize:14, fontWeight:600, color:"var(--link)" }}>See which times</summary>
      <div style={{ display:"grid", gap:8, marginTop:8 }}>
        {days.map(d => (
          <div key={d} style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13.5, fontWeight:700, minWidth:92 }}>{fmtDay(d)}</span>
            {slots.filter(x=>x.date===d).map(x => { const l = look[state(x)];
              return <span key={x.key} aria-label={`${fmtDay(d)}, ${fmtWindow(x.from, x.to)}: ${l.word}`}
                style={{ fontSize:13, fontWeight:600, padding:"3px 9px", borderRadius:999, background:l.bg, color:l.fg, border:"1.5px solid currentColor" }}>
                <span aria-hidden="true">{l.mark} </span>{fmtWindow(x.from, x.to)}</span>; })}
          </div>
        ))}
      </div>
    </details>
  );
}
