import { useState, useMemo, useEffect, useRef } from 'react';
import { ROOMS, ALL_FEATURES, BUILDINGS, TYPES, STATUS, slotState } from '../data/mock.js';
import { LIVE, availableRooms, dayKeyOf } from '../api.js';
import Pill from '../components/Pill.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import Feature from '../components/Feature.jsx';
import RoomPhoto from '../components/RoomPhoto.jsx';
import useDialog from '../a11y/useDialog.js';
import { useIsPhone, useScrollLock } from '../useMedia.js';

const PAGE_SIZE = 10;

export default function FindSpace({ onView, onBook, rooms = ROOMS, loading = false }) {
  const buildings = useMemo(()=> rooms===ROOMS ? BUILDINGS : [BUILDINGS[0], ...[...new Set(rooms.map(r=>r.building))].sort()],[rooms]);
  const types = useMemo(()=> rooms===ROOMS ? TYPES : [TYPES[0], ...[...new Set(rooms.map(r=>r.type))].sort()],[rooms]);
  // Live rooms have their own features (25Live names and our tags), not the mock list.
  const allFeatures = useMemo(()=> rooms===ROOMS ? ALL_FEATURES : [...new Set(rooms.flatMap(r=>r.features))].sort(),[rooms]);
  const [q,setQ]=useState(""); const [building,setBuilding]=useState(BUILDINGS[0]); const [type,setType]=useState(TYPES[0]);
  const [minCap,setMinCap]=useState(0);
  const [picked,setPicked]=useState([]); const [fq,setFq]=useState("");
  const [page,setPage]=useState(1);
  // "Free at a specific time": pick a day and a time window, and only rooms that are free for all of it are shown.
  const todayKey = dayKeyOf(new Date());
  const [whenOn,setWhenOn]=useState(false);
  const [wDate,setWDate]=useState(todayKey); const [wStart,setWStart]=useState("18:00"); const [wEnd,setWEnd]=useState("19:00");
  const [freeIds,setFreeIds]=useState(null);       // live mode: Set of room ids free in that window (null = not loaded)
  const [freeBusy,setFreeBusy]=useState(false); const [freeErr,setFreeErr]=useState("");
  const whenOk = whenOn && !!wDate && wDate>=todayKey && !!wStart && !!wEnd && wEnd>wStart;
  useEffect(()=>{
    if (!whenOk || !LIVE) { setFreeIds(null); setFreeErr(""); setFreeBusy(false); return; }
    let off=false; setFreeBusy(true); setFreeErr("");
    const t=setTimeout(()=>{
      availableRooms(wDate,wStart,wEnd)
        .then(list=>{ if(!off){ setFreeIds(new Set(list.map(r=>r.id))); setFreeBusy(false); } })
        .catch(e=>{ if(!off){ setFreeIds(null); setFreeErr(e.message||"Couldn't check availability."); setFreeBusy(false); } });
    },350);
    return ()=>{ off=true; clearTimeout(t); };
  },[whenOk,wDate,wStart,wEnd]);
  const isFree = r => {
    if (!whenOk) return true;
    if (LIVE) return freeIds ? freeIds.has(r.id) : !!freeErr;
    const sm=Number(wStart.slice(0,2))*60+Number(wStart.slice(3)), em=Number(wEnd.slice(0,2))*60+Number(wEnd.slice(3));
    for (let h=9; h<=20; h++) if (h*60<em && (h+1)*60>sm && slotState(r,wDate,`${h}:00`)==="taken") return false;
    return true;
  };
  const toggle = f => setPicked(p => p.includes(f) ? p.filter(x=>x!==f) : [...p,f]);
  const shownFeatures = allFeatures.filter(f => f.toLowerCase().includes(fq.toLowerCase()));

  const filtered = useMemo(()=>rooms.filter(r=>{
    if (q && !`${r.name} ${r.building}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (building!==BUILDINGS[0] && r.building!==building) return false;
    if (type!==TYPES[0] && r.type!==type) return false;
    if (minCap && r.cap < minCap) return false;
    if (!picked.every(f => r.features.includes(f))) return false;
    if (!isFree(r)) return false;
    return true;
  }),[rooms,q,building,type,minCap,picked,whenOk,wDate,wStart,wEnd,freeIds]);

  // Back to page 1 whenever the filters (or the room list) change.
  useEffect(() => setPage(1), [rooms,q,building,type,minCap,picked,whenOk,wDate,wStart,wEnd,freeIds]);
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
  const activeFilters = (building!==BUILDINGS[0]) + (type!==TYPES[0]) + (minCap>0) + picked.length + (whenOk?1:0);
  const clearAll = () => { setBuilding(BUILDINGS[0]); setType(TYPES[0]); setMinCap(0); setPicked([]); setFq(""); setWhenOn(false); };

  const goTo = p => { setPage(p); window.scrollTo({ top:0, behavior:"smooth" }); };
  const pageBtn = disabled => ({ padding:"8px 14px", borderRadius:8, fontSize:14, fontWeight:600, border:"2px solid var(--ink)",
    color:"var(--ink)", background: disabled ? "var(--paper)" : "var(--blue)", opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "default" : "pointer" });

  return (
    <main className="page" style={{ maxWidth:1400, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Find a space to book</h1>
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
            {activeFilters>0 && <button onClick={clearAll} style={{ fontSize:15, fontWeight:700, color:"var(--link)" }}>Clear all</button>}
          </div>
          <div className="hide-phone">
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or building"
            style={{ width:"100%", margin:"6px 0 14px", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
            borderRadius:8, background:"var(--paper)", outline:"none" }} />
          </div>
          <div style={{ border:"2px solid var(--ink)", borderRadius:10, padding:"12px 12px 10px", marginBottom:16, background: whenOn ? "var(--blue-wash)" : "var(--paper)" }}>
            <label style={{ display:"flex", alignItems:"center", gap:9, fontSize:14.5, fontWeight:700, cursor:"pointer" }}>
              <input type="checkbox" checked={whenOn} onChange={e=>setWhenOn(e.target.checked)} style={{ accentColor:"var(--blue)" }} />
              Only rooms free at a certain time
            </label>
            {whenOn && (
              <div style={{ marginTop:10, display:"grid", gap:8 }}>
                <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Day
                  <input type="date" min={todayKey} value={wDate} onChange={e=>setWDate(e.target.value)}
                    style={{ width:"100%", marginTop:4, padding:"8px 10px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }} />
                </label>
                <div style={{ display:"flex", gap:8 }}>
                  <label style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>From
                    <input type="time" step={900} value={wStart} onChange={e=>setWStart(e.target.value)}
                      style={{ width:"100%", marginTop:4, padding:"8px 8px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }} />
                  </label>
                  <label style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>To
                    <input type="time" step={900} value={wEnd} onChange={e=>setWEnd(e.target.value)}
                      style={{ width:"100%", marginTop:4, padding:"8px 8px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }} />
                  </label>
                </div>
                <div role="status" style={{ fontSize:13, color: freeErr || !whenOk ? "var(--red)" : "var(--ink-soft)", fontWeight:600 }}>
                  {!wDate || wDate < todayKey ? "Pick today or a later day."
                    : wEnd <= wStart ? "The end time has to be after the start time."
                    : freeErr ? freeErr
                    : freeBusy ? "Checking which rooms are free…"
                    : "Showing rooms with no booking or closure in that window."}
                </div>
              </div>
            )}
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
          {!loading && filtered.length===0 && <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)",
            background:"var(--card)", borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No spaces match those filters.</div>}
          {!loading && filtered.length>0 && (
            <div style={{ fontSize:14, color:"var(--ink-faint)" }}>
              Showing {(current-1)*PAGE_SIZE+1}–{Math.min(current*PAGE_SIZE, filtered.length)} of {filtered.length} spaces
            </div>
          )}
          {shown.map(r => (
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
                <Pill status={r.status} />
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, margin:"12px 0" }}>
                {r.features.slice(0,5).map(f=><Feature key={f}>{f}</Feature>)}
                {r.features.length>5 && <Feature>+{r.features.length-5} more</Feature>}
              </div>
              <div style={{ fontSize:14, color:r.closed?"var(--slate)":"var(--ink-soft)", background:r.closed?"var(--slate-wash)":"var(--paper)",
                padding:"8px 11px", borderRadius:8, marginBottom:12 }}>{r.note}</div>
              {!r.closed && (
                <div className="room-card-actions" style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <span style={{ fontSize:14.5, fontWeight:600, color:"var(--link)" }}>View room details ›</span>
                  <button onClick={e=>{ e.stopPropagation(); onBook(r); }} style={{ marginLeft:"auto", padding:"8px 16px",
                    borderRadius:8, fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--blue)" }}>Book</button>
                </div>
              )}
              </div>
            </div>
          ))}
          {pageCount > 1 && (
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
