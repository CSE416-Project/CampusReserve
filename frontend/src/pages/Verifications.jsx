import { useState } from 'react';
import OrgLink from '../components/OrgLink.jsx';
import Avatar from '../components/Avatar.jsx';

export default function Verifications({ items, onApprove, onReject, onOpenClub, error }) {
  const [busy,setBusy]=useState(null); const [notice,setNotice]=useState("");
  const act = async (fn, it, text) => {
    setBusy(it.id); setNotice("");
    try { await fn(it); setNotice(text); } catch { /* shown via error prop */ }
    setBusy(null);
  };
  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>Verification requests ({items.length})</h1>
      <div style={{ fontSize:14.5, color:"var(--ink-soft)", marginBottom:18 }}>
        Club leaders ask to be verified as e-board members. Only verified members can request bookings for a club.
      </div>
      {notice && <div role="status" style={{ background:"var(--green-wash)", color:"var(--ink-soft)", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:14.5 }}>✓ {notice}</div>}
      {items.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No verification requests waiting.</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {items.map(it => (
            <div key={it.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)",
              display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
              <Avatar person name={it.userName} size={46} />
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontWeight:700, fontSize:16 }}>{it.userName}</div>
                <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{it.email}</div>
                <div style={{ fontSize:14.5, marginTop:4 }}>
                  Wants to be verified as <b>{it.position || "e-board member"}</b> of <OrgLink name={it.orgName} onOpen={onOpenClub} />
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button disabled={busy===it.id} onClick={()=>act(onApprove, it, `Verified ${it.userName} for ${it.orgName}.`)} style={{ padding:"8px 16px", borderRadius:8,
                  fontSize:14, fontWeight:600, color:"var(--ink)", background:"var(--mint)" }}>Verify</button>
                <button disabled={busy===it.id} onClick={()=>act(onReject, it, `Rejected ${it.userName}'s request for ${it.orgName}.`)} style={{ padding:"8px 16px", borderRadius:8,
                  fontSize:14, fontWeight:600, color:"var(--red)", background:"var(--red-wash)" }}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
