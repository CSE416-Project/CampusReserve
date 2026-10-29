import { useState, useMemo } from 'react';
import { SB_ENGAGED_URL } from '../data/mock.js';
import Pill from '../components/Pill.jsx';

export default function MyRequests({ requests, showOrg = false, clubs = [], onCancel }) {
  const [status,setStatus]=useState("All"); const [q,setQ]=useState("");
  const buildings = ["All buildings", ...new Set(requests.map(r=>r.room.building))];
  const [building,setBuilding]=useState("All buildings");
  const [asking,setAsking]=useState(null); const [busy,setBusy]=useState(null);
  const cancel = async id => { setBusy(id); try { await onCancel(id); } catch { /* error banner is shown by the app */ } setBusy(null); setAsking(null); };

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
          {["All","pending","waitlisted","approved","denied","cancelled"].map(s=><option key={s}>{s}</option>)}
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
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.event || req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{req.event ? `${req.room.name} · ` : ""}{showOrg ? `${req.org} · ` : ""}{req.room.building} · {req.date} · {req.time}</div>
                  {req.status==="denied" && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason: {req.reason}</div>}
                </div>
                <Pill status={req.status} />
              </div>
              {req.status==="waitlisted" && (
                <div style={{ marginTop:12, background:"var(--blue-wash)", borderRadius:10, padding:"11px 14px", fontSize:14, color:"var(--ink-soft)", lineHeight:1.5 }}>
                  <b>Your spot: #{req.position || "–"}</b> in line for this time. {req.position > 1 ? `${req.position - 1} club${req.position === 2 ? "" : "s"} ahead of you.` : "You're next in line."}
                  {" "}You can't book this room unless the current group cancels. If they do, your request moves back to pending review and you'll get a notification.
                </div>
              )}
              {req.status!=="denied" && req.status!=="cancelled" && onCancel && (
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {asking===req.id ? (<>
                    <span style={{ fontSize:14, fontWeight:600 }}>{req.status==="waitlisted" ? "Leave the waitlist?" : "Cancel this request?"}</span>
                    <button disabled={busy===req.id} onClick={()=>cancel(req.id)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--red)", color:"#fff", cursor:"pointer" }}>{busy===req.id ? "Cancelling…" : "Yes, cancel it"}</button>
                    <button disabled={busy===req.id} onClick={()=>setAsking(null)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", color:"var(--ink)", cursor:"pointer" }}>Keep it</button>
                  </>) : (
                    <button onClick={()=>setAsking(req.id)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", color:"var(--ink)", cursor:"pointer" }}>{req.status==="waitlisted" ? "Leave waitlist" : "Cancel request"}</button>
                  )}
                </div>
              )}
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
