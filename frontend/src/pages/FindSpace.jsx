import { useState, useMemo } from 'react';
import { ROOMS, ALL_FEATURES, BUILDINGS, TYPES, STATUS } from '../data/mock.js';
import Pill from '../components/Pill.jsx';
import Feature from '../components/Feature.jsx';
import RoomPhoto from '../components/RoomPhoto.jsx';

export default function FindSpace({ onView, onBook }) {
  const [q,setQ]=useState(""); const [building,setBuilding]=useState(BUILDINGS[0]); const [type,setType]=useState(TYPES[0]);
  const [minCap,setMinCap]=useState(0);
  const [picked,setPicked]=useState([]); const [fq,setFq]=useState("");
  const toggle = f => setPicked(p => p.includes(f) ? p.filter(x=>x!==f) : [...p,f]);
  const shownFeatures = ALL_FEATURES.filter(f => f.toLowerCase().includes(fq.toLowerCase()));

  const filtered = useMemo(()=>ROOMS.filter(r=>{
    if (q && !`${r.name} ${r.building}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (building!==BUILDINGS[0] && r.building!==building) return false;
    if (type!==TYPES[0] && r.type!==type) return false;
    if (minCap && r.cap < minCap) return false;
    if (!picked.every(f => r.features.includes(f))) return false;
    return true;
  }),[q,building,type,minCap,picked]);

  return (
    <main style={{ maxWidth:1400, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Find a space to book</h1>
      <div style={{ display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" }}>
        <aside style={{ width:340, flexShrink:0, position:"sticky", top:80, background:"var(--card)", border:"2px solid var(--ink)",
          borderRadius:14, padding:18, boxShadow:"var(--shadow)" }}>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or building"
            style={{ width:"100%", margin:"6px 0 14px", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
            borderRadius:8, background:"var(--paper)", outline:"none" }} />
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Building</label>
          <select value={building} onChange={e=>setBuilding(e.target.value)} style={{ width:"100%", margin:"6px 0 14px",
            padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)" }}>
            {BUILDINGS.map(o=><option key={o}>{o}</option>)}
          </select>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Space type</label>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ width:"100%", margin:"6px 0 14px",
            padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)" }}>
            {TYPES.map(o=><option key={o}>{o}</option>)}
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
          <div style={{ maxHeight:"calc(100vh - 520px)", minHeight:220, overflowY:"auto", border:"2px solid var(--ink)",
            borderRadius:8, padding:"4px 10px", background:"var(--paper)" }}>
            {shownFeatures.map(ft => (
              <label key={ft} style={{ display:"flex", alignItems:"flex-start", gap:9, padding:"6px 0", fontSize:14, cursor:"pointer" }}>
                <input type="checkbox" checked={picked.includes(ft)} onChange={()=>toggle(ft)} style={{ marginTop:3, accentColor:"var(--blue)" }} />
                <span>{ft}</span>
              </label>
            ))}
            {shownFeatures.length===0 && <div style={{ padding:"10px 0", fontSize:14, color:"var(--ink-faint)" }}>No matching features</div>}
          </div>
        </aside>

        <div style={{ flex:1, minWidth:280, display:"grid", gap:14 }}>
          {filtered.length===0 && <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)",
            background:"var(--card)", borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No spaces match those filters.</div>}
          {filtered.map(r => (
            <div key={r.id} onClick={()=>!r.closed && onView(r)} style={{ display:"flex", gap:18, flexWrap:"wrap", background:"var(--card)", border:"2px solid var(--ink)",
              borderRadius:14, padding:18, boxShadow:"var(--shadow)", opacity:r.closed?0.65:1, cursor:r.closed?"default":"pointer",
              borderLeft:`4px solid ${STATUS[r.status].fg}` }}>
              <div style={{ width:200, flexShrink:0 }}><RoomPhoto room={r} /></div>
              <div style={{ flex:1, minWidth:240 }}>
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
                <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                  <span style={{ fontSize:14.5, fontWeight:600, color:"var(--link)" }}>View room details ›</span>
                  <button onClick={e=>{ e.stopPropagation(); onBook(r); }} style={{ marginLeft:"auto", padding:"8px 16px",
                    borderRadius:8, fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--blue)" }}>Book</button>
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
