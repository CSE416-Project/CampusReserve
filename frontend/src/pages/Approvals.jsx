import OrgLink from '../components/OrgLink.jsx';
import { useEffect, useState } from 'react';
import Pill from '../components/Pill.jsx';

export default function Approvals({ requests, onDecide, onOpenClub, clubs = [] }) {
  const [tab,setTab]=useState("pending");
  const [notice,setNotice]=useState(null);              // { kind: "ok" | "error", text }
  const [denying,setDenying]=useState(null); const [reason,setReason]=useState("");
  // Requests decided here: { [id]: "approved" | "denied" }. They are hidden from Pending right away,
  // and their buttons can't be pressed again, even before the list reloads from the server.
  const [decided,setDecided]=useState({});
  const [busy,setBusy]=useState(null);                  // id of the request being saved

  // Once the server's list shows a request as no longer pending, drop it from `decided`.
  useEffect(()=>{
    setDecided(d=>{
      const next={...d}; let changed=false;
      for (const r of requests) if (next[r.id] && r.status!=="pending") { delete next[r.id]; changed=true; }
      return changed ? next : d;
    });
  },[requests]);

  // The banner goes away on its own after a few seconds.
  useEffect(()=>{
    if (!notice) return;
    const t=setTimeout(()=>setNotice(null), notice.kind==="error" ? 8000 : 5000);
    return ()=>clearTimeout(t);
  },[notice]);

  const statusOf = r => decided[r.id] || r.status;
  const pending = requests.filter(r=>statusOf(r)==="pending");
  const waitlisted = requests.filter(r=>statusOf(r)==="waitlisted");
  const reviewed = requests.filter(r=>statusOf(r)!=="pending" && statusOf(r)!=="waitlisted");
  const list = tab==="pending" ? pending : tab==="waitlist" ? waitlisted : reviewed;

  async function decide(req, status, why) {
    if (busy || decided[req.id]) return;                // already deciding / decided
    setBusy(req.id);
    setDecided(d=>({...d,[req.id]:status}));
    setDenying(null); setReason("");
    try {
      await onDecide(req.id, status, why);
      if (status==="approved") {
        const n = clubs.find(c=>c.name===req.org)?.count || 1;
        setNotice({ kind:"ok", text:`Approved ${req.room.name} for ${req.org}. Email sent to ${n} e-board member${n===1?"":"s"}.` });
      } else {
        setNotice({ kind:"ok", text:`Denied ${req.room.name} for ${req.org}. The requester will see your reason.` });
      }
    } catch (e) {
      setDecided(d=>{ const next={...d}; delete next[req.id]; return next; });   // put it back in Pending
      setNotice({ kind:"error", text:`Couldn't save that decision: ${e?.message || "please try again."}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Approvals</h1>

      <div style={{ display:"flex", gap:6, marginBottom:18 }}>
        {[["pending",`Pending (${pending.length})`],["waitlist",`Waitlist (${waitlisted.length})`],["reviewed","Reviewed"]].map(([id,label])=>(
          <button key={id} onClick={()=>{ setTab(id); setDenying(null); setReason(""); }} style={{ padding:"8px 15px", borderRadius:8, fontSize:14, fontWeight:600,
            background: tab===id?"var(--blue)":"var(--line-soft)", color: tab===id?"var(--ink)":"var(--ink-soft)" }}>{label}</button>
        ))}
      </div>

      {notice && (
        <div role="status" style={{ display:"flex", alignItems:"center", gap:10,
          background: notice.kind==="error" ? "var(--red-wash)" : "var(--green-wash)",
          color: notice.kind==="error" ? "var(--red)" : "var(--ink-soft)",
          borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:14.5 }}>
          <span style={{ flex:1 }}>{notice.kind==="error" ? "⚠" : "✓"} {notice.text}</span>
          <button onClick={()=>setNotice(null)} aria-label="Dismiss" style={{ fontSize:18, lineHeight:1, padding:"2px 6px",
            borderRadius:6, color:"inherit", background:"transparent" }}>×</button>
        </div>
      )}

      {list.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>
          {tab==="pending" ? "Nothing waiting on you right now." : tab==="waitlist" ? "No clubs are on a waitlist." : "No decisions made yet."}
        </div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {list.map(req => {
            const status = statusOf(req);
            const locked = busy===req.id || status!=="pending";
            return (
            <div key={req.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.event || req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{req.event ? `${req.room.name} · ` : ""}<OrgLink name={req.org} onOpen={onOpenClub} /> · {req.date} · {req.time}</div>
                  {status==="waitlisted" && <div style={{ fontSize:14, color:"var(--link)", fontWeight:600, marginTop:4 }}>Waitlist spot #{req.position || "–"}. Moves to pending automatically if the current booking is cancelled.</div>}
                  {status==="denied" && req.reason && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason given: {req.reason}</div>}
                </div>
                <Pill status={status} />
              </div>
              {tab==="pending" && status==="pending" && (denying===req.id ? (
                <div style={{ marginTop:12 }}>
                  <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for denial (shared with the requester)"
                    rows={2} style={{ width:"100%", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)",
                    borderRadius:8, background:"var(--paper)", resize:"vertical" }} />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button disabled={!reason.trim() || locked} onClick={()=>decide(req,"denied",reason.trim())}
                      style={{ padding:"8px 14px", borderRadius:8, fontSize:14, fontWeight:600, color:"var(--ink)",
                      background: reason.trim()?"var(--rose)":"var(--line-soft)" }}>Confirm denial</button>
                    <button onClick={()=>{ setDenying(null); setReason(""); }} style={{ padding:"8px 14px", borderRadius:8,
                      fontSize:14, fontWeight:600, background:"var(--line-soft)", color:"var(--ink-soft)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <button disabled={locked} onClick={()=>decide(req,"approved")} style={{ padding:"8px 16px", borderRadius:8,
                    fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--mint)" }}>Approve</button>
                  <button disabled={locked} onClick={()=>{ setDenying(req.id); setReason(""); }} style={{ padding:"8px 16px", borderRadius:8,
                    fontSize:14, fontWeight:600, color:"var(--red)", background:"var(--red-wash)" }}>Deny</button>
                </div>
              ))}
            </div>
          );})}
        </div>
      )}
    </main>
  );
}
