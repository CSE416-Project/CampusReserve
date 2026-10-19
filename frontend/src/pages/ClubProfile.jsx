import { CLUBS } from '../data/mock.js';
import Avatar from '../components/Avatar.jsx';
import Pill from '../components/Pill.jsx';

export default function ClubProfile({ name, requests, selfOrg, onBack, onMessage }) {
  const club = CLUBS.find(c => c.name === name);
  if (!club) return null;
  const upcoming = requests.filter(r => r.org === club.name && r.status === "approved");
  return (
    <main style={{ maxWidth:900, margin:"0 auto", padding:"24px 24px 60px" }}>
      <button onClick={onBack} style={{ fontSize:14.5, fontWeight:600, color:"var(--blue)", marginBottom:14 }}>‹ Back</button>

      <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap", marginBottom:22 }}>
        <Avatar name={club.name} size={72} />
        <div style={{ flex:1, minWidth:220 }}>
          <h1 style={{ fontSize:28, fontWeight:800 }}>{club.name}</h1>
          <div style={{ fontSize:15, color:"var(--ink-faint)" }}>{club.category}</div>
        </div>
        {club.name !== selfOrg && (
          <button onClick={()=>onMessage(club.name)} style={{ padding:"11px 20px", borderRadius:11, fontSize:15, fontWeight:700,
            color:"var(--blue)", background:"var(--blue-wash)" }}>Message club</button>
        )}
      </div>

      <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>About</div>
      <div style={{ fontSize:15.5, color:"var(--ink-soft)", background:"var(--card)", border:"1px solid var(--line)", borderRadius:14,
        padding:"16px 18px", marginBottom:26, lineHeight:1.6 }}>{club.bio}</div>

      <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>E-board ({club.eboard.length})</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12, marginBottom:26 }}>
        {club.eboard.map(m => (
          <div key={m.email} style={{ display:"flex", gap:12, alignItems:"center", background:"var(--card)", border:"1px solid var(--line)",
            borderRadius:14, padding:"14px 16px" }}>
            <Avatar name={m.name} />
            <div>
              <div style={{ fontWeight:700, fontSize:15.5 }}>{m.name}</div>
              <div style={{ fontSize:14, color:"var(--ink-soft)" }}>{m.title}</div>
              <div style={{ fontSize:13, color:"var(--ink-faint)" }}>{m.email}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>Upcoming bookings</div>
      {upcoming.length===0 ? (
        <div style={{ fontSize:15, color:"var(--ink-faint)" }}>No approved bookings yet.</div>
      ) : (
        <div style={{ display:"grid", gap:10 }}>
          {upcoming.map(r => (
            <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--card)",
              border:"1px solid var(--line)", borderRadius:12, padding:"12px 16px" }}>
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
