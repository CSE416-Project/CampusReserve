import OrgLink from '../components/OrgLink.jsx';
import { useState } from 'react';
import Pill from '../components/Pill.jsx';

export default function Approvals({ requests, onDecide, onOpenClub }) {
  const [tab,setTab]=useState("pending");
  const [denying,setDenying]=useState(null); const [reason,setReason]=useState("");
  const pending = requests.filter(r=>r.status==="pending");
  const reviewed = requests.filter(r=>r.status!=="pending");
  const list = tab==="pending" ? pending : reviewed;

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>Approvals</h1>
      <p style={{ fontSize:15, color:"var(--ink-soft)", marginBottom:16 }}>A reason is required for every denial.</p>

      <div style={{ display:"flex", gap:6, marginBottom:18 }}>
        {[["pending",`Pending (${pending.length})`],["reviewed","Reviewed"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"8px 15px", borderRadius:9, fontSize:14, fontWeight:600,
            background: tab===id?"var(--ink)":"var(--line-soft)", color: tab===id?"#fff":"var(--ink-soft)" }}>{label}</button>
        ))}
      </div>

      {list.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"1px dashed var(--line)" }}>
          {tab==="pending" ? "Nothing waiting on you right now." : "No decisions made yet."}
        </div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {list.map(req => (
            <div key={req.id} style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}><OrgLink name={req.org} onOpen={onOpenClub} /> · {req.date} · {req.time}</div>
                  {req.status==="denied" && req.reason && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason given: {req.reason}</div>}
                </div>
                <Pill status={req.status} />
              </div>
              {tab==="pending" && (denying===req.id ? (
                <div style={{ marginTop:12 }}>
                  <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for denial (shared with the requester)"
                    rows={2} style={{ width:"100%", padding:"9px 11px", fontSize:14.5, border:"1px solid var(--line)",
                    borderRadius:9, background:"var(--paper)", resize:"vertical" }} />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button disabled={!reason.trim()} onClick={()=>{ onDecide(req.id,"denied",reason); setDenying(null); setReason(""); }}
                      style={{ padding:"8px 14px", borderRadius:9, fontSize:14, fontWeight:600, color:"#fff",
                      background: reason.trim()?"var(--red)":"var(--slate)" }}>Confirm denial</button>
                    <button onClick={()=>{ setDenying(null); setReason(""); }} style={{ padding:"8px 14px", borderRadius:9,
                      fontSize:14, fontWeight:600, background:"var(--line-soft)", color:"var(--ink-soft)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <button onClick={()=>onDecide(req.id,"approved")} style={{ padding:"8px 16px", borderRadius:9,
                    fontSize:14, fontWeight:600, color:"#fff", background:"var(--green)" }}>Approve</button>
                  <button onClick={()=>setDenying(req.id)} style={{ padding:"8px 16px", borderRadius:9,
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
