import { useState, useMemo } from 'react';
import { SB_ENGAGED_URL } from '../data/mock.js';
import Pill from '../components/Pill.jsx';

export default function MyRequests({ requests, showOrg = false, clubs = [] }) {
  const [status,setStatus]=useState("All"); const [q,setQ]=useState("");
  const buildings = ["All buildings", ...new Set(requests.map(r=>r.room.building))];
  const [building,setBuilding]=useState("All buildings");

  const filtered = useMemo(()=>requests.filter(r=>{
    if (status!=="All" && r.status!==status) return false;
    if (building!=="All buildings" && r.room.building!==building) return false;
    if (q && !r.room.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }),[requests,status,building,q]);

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>My requests</h1>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by room"
          style={{ flex:"1 1 200px", padding:"9px 12px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", outline:"none" }} />
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{ padding:"9px 12px", fontSize:14.5,
          border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }}>
          {["All","pending","approved","denied"].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={building} onChange={e=>setBuilding(e.target.value)} style={{ padding:"9px 12px", fontSize:14.5,
          border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }}>
          {buildings.map(b=><option key={b}>{b}</option>)}
        </select>
      </div>

      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No requests match those filters.</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {filtered.map(req => (
            <div key={req.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14,
              padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{showOrg ? `${req.org} · ` : ""}{req.room.building} · {req.date} · {req.time}</div>
                  {req.status==="denied" && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason: {req.reason}</div>}
                </div>
                <Pill status={req.status} />
              </div>
              {req.status==="approved" && (
                <div style={{ marginTop:12, background:"var(--green-wash)", borderRadius:10, padding:"11px 14px",
                  fontSize:14, color:"var(--ink-soft)" }}>
                  Approved — <a href={SB_ENGAGED_URL} target="_blank" rel="noreferrer" style={{ color:"var(--link)", fontWeight:600 }}>
                    complete your SB Engaged event form</a> within <b>48 hours</b> to confirm this booking.
                  <div style={{ marginTop:4, color:"var(--ink-faint)", fontSize:13.5 }}>
                    Email confirmation sent to your e-board ({clubs.find(c=>c.name===req.org)?.count || 1} {(clubs.find(c=>c.name===req.org)?.count || 1) === 1 ? "person" : "people"}).
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
