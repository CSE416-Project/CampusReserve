import { useState, useEffect } from 'react';
import { orgDetail } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Pill from '../components/Pill.jsx';

export default function ClubProfile({ name, clubs, requests, selfId, onBack, onMessagePerson }) {
  const club = clubs.find(c => c.name === name);
  const [members,setMembers]=useState(null); // live: verified e-board members, or null when the server hides them
  useEffect(()=>{
    setMembers(null);
    if (!club?.live) return;
    let off=false;
    orgDetail(club.id).then(d=>{ if(!off && d.members) setMembers(d.members.filter(m=>m.verified).map(m=>({ name:m.user_name, title:m.position_title || "E-board member", email:m.user_email, id:m.user_id }))); }).catch(()=>{});
    return ()=>{ off=true; };
  },[club?.id]);
  if (!club) return null;
  const eboard = club.live ? members : club.eboard;
  const upcoming = requests.filter(r => r.org === club.name && r.status === "approved");
  return (
    <main className="page" style={{ maxWidth:900, margin:"0 auto", padding:"24px 24px 60px" }}>
      <button onClick={onBack} style={{ fontSize:14.5, fontWeight:600, color:"var(--link)", marginBottom:14 }}>‹ Back</button>

      <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap", marginBottom:22 }}>
        <Avatar name={club.name} size={72} />
        <div style={{ flex:1, minWidth:220 }}>
          <h1 style={{ fontSize:28, fontWeight:800 }}>{club.name}</h1>
          {club.category && <div style={{ fontSize:15, color:"var(--ink-faint)" }}>{club.category}</div>}
        </div>
      </div>

      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>About</div>
      <div style={{ fontSize:15.5, color:"var(--ink-soft)", background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14,
        padding:"16px 18px", marginBottom:26, lineHeight:1.6 }}>{club.bio || "This club hasn't added a description yet."}</div>

      <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>E-board ({eboard ? eboard.length : club.count})</div>
      {!eboard ? (
        <div style={{ fontSize:14.5, color:"var(--ink-soft)", marginBottom:26 }}>
          {club.count} verified e-board member{club.count === 1 ? "" : "s"}. Names are visible to admins and the club's own members.
        </div>
      ) : (<>
      {!club.live && <div style={{ fontSize:14, color:"var(--ink-soft)", marginBottom:12 }}>One e-board member holds the club's account. Everyone listed gets an email when a booking is approved.</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(260px,100%),1fr))", gap:12, marginBottom:26, marginTop: club.live ? 12 : 0 }}>
        {eboard.map(m => (
          <div key={m.email} style={{ display:"flex", gap:12, alignItems:"center", background:"var(--card)", border:"2px solid var(--ink)",
            borderRadius:14, padding:"14px 16px" }}>
            <Avatar person name={m.name} />
            <div>
              <div style={{ fontWeight:700, fontSize:15.5 }}>{m.name}</div>
              <div style={{ fontSize:14, color:"var(--ink-soft)" }}>{m.title}</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)" }}>{m.email}</div>
              {m.email !== selfId && m.id !== selfId && (
                <button onClick={()=>onMessagePerson({ id: m.id || m.email, name: m.name, sub: m.title })} style={{ display:"block", marginTop:8, padding:"6px 14px", borderRadius:8,
                  fontSize:13.5, fontWeight:700, color:"var(--ink)", border:"2px solid var(--ink)", background:"var(--blue-wash)" }}>Message</button>
              )}
              {!club.live && <span style={{ display:"inline-block", marginTop:6, fontSize:12, fontWeight:600, padding:"3px 9px", borderRadius:999,
                background: m.holder ? "var(--blue-wash)" : "var(--slate-wash)", color: m.holder ? "var(--link)" : "var(--ink-soft)" }}>
                {m.holder ? "Account holder" : "Email notifications only"}</span>}
            </div>
          </div>
        ))}
        {eboard.length === 0 && <div style={{ fontSize:14.5, color:"var(--ink-faint)" }}>No verified e-board members yet.</div>}
      </div>
      </>)}

      <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>Upcoming bookings</div>
      {upcoming.length===0 ? (
        <div style={{ fontSize:15, color:"var(--ink-faint)" }}>No approved bookings yet.</div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {upcoming.map(r => (
            <div key={r.id} className="row-wrap" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--card)",
              border:"2px solid var(--ink)", borderRadius:10, padding:"12px 16px" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{r.room.name}</div>
                <div style={{ fontSize:13.5, color:"var(--ink-faint)" }}>{r.room.building} · {r.date} · {r.time}</div>
              </div>
              <Pill status={r.status} small />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
