import OrgLink from '../components/OrgLink.jsx';
import { useState } from 'react';
import Pill from '../components/Pill.jsx';

export default function Approvals({ requests, onDecide, onOpenClub, clubs = [] }) {
  const [tab,setTab]=useState("pending");
  const [notice,setNotice]=useState(null);
  const [denying,setDenying]=useState(null); const [reason,setReason]=useState("");
  const pending = requests.filter(r=>r.status==="pending");
  const waitlisted = requests.filter(r=>r.status==="waitlisted");
  const reviewed = requests.filter(r=>r.status!=="pending" && r.status!=="waitlisted");
  const list = tab==="pending" ? pending : tab==="waitlist" ? waitlisted : reviewed;

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Approvals</h1>

      <div style={{ display:"flex", gap:6, marginBottom:18 }}>
        {[["pending",`Pending (${pending.length})`],["waitlist",`Waitlist (${waitlisted.length})`],["reviewed","Reviewed"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"8px 15px", borderRadius:8, fontSize:14, fontWeight:600,
            background: tab===id?"var(--blue)":"var(--line-soft)", color: tab===id?"var(--ink)":"var(--ink-soft)" }}>{label}</button>
        ))}
      </div>

      {notice && <div style={{ background:"var(--green-wash)", color:"var(--ink-soft)", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:14.5 }}>✓ {notice}</div>}

      {list.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>
          {tab==="pending" ? "Nothing waiting on you right now." : tab==="waitlist" ? "No clubs are on a waitlist." : "No decisions made yet."}
        </div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {list.map(req => (
            <div key={req.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.event || req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{req.event ? `${req.room.name} · ` : ""}<OrgLink name={req.org} onOpen={onOpenClub} /> · {req.date} · {req.time}</div>
                  {req.status==="waitlisted" && <div style={{ fontSize:14, color:"var(--link)", fontWeight:600, marginTop:4 }}>Waitlist spot #{req.position || "–"}. Moves to pending automatically if the current booking is cancelled.</div>}
                  {req.status==="denied" && req.reason && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason given: {req.reason}</div>}
                </div>
                <Pill status={req.status} />
              </div>
              {tab==="pending" && (denying===req.id ? (
                <div style={{ marginTop:12 }}>
                  <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for denial (shared with the requester)"
                    rows={2} style={{ width:"100%", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
                    borderRadius:8, background:"var(--paper)", resize:"vertical" }} />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button disabled={!reason.trim()} onClick={()=>{ onDecide(req.id,"denied",reason); setDenying(null); setReason(""); }}
                      style={{ padding:"8px 14px", borderRadius:8, fontSize:14, fontWeight:600, color:"var(--ink)",
                      background: reason.trim()?"var(--rose)":"var(--line-soft)" }}>Confirm denial</button>
                    <button onClick={()=>{ setDenying(null); setReason(""); }} style={{ padding:"8px 14px", borderRadius:8,
                      fontSize:14, fontWeight:600, background:"var(--line-soft)", color:"var(--ink-soft)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <button onClick={()=>{ onDecide(req.id,"approved"); const n = clubs.find(c=>c.name===req.org)?.count || 1; setNotice(`Approved ${req.room.name} for ${req.org}. Email sent to ${n} e-board member${n===1?"":"s"}.`); }} style={{ padding:"8px 16px", borderRadius:8,
                    fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--mint)" }}>Approve</button>
                  <button onClick={()=>setDenying(req.id)} style={{ padding:"8px 16px", borderRadius:8,
                    fontSize:14, fontWeight:600, color:"var(--red)", background:"var(--red-wash)" }}>Deny</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
