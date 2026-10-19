import { useState } from 'react';
import { CLUBS } from '../data/mock.js';
import Avatar from '../components/Avatar.jsx';

export default function Clubs({ onOpenClub }) {
  const [q,setQ]=useState("");
  const list = CLUBS.filter(c => `${c.name} ${c.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main style={{ maxWidth:1000, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>Clubs</h1>
      <p style={{ fontSize:15, color:"var(--ink-soft)", marginBottom:18 }}>Browse registered organizations and meet their e-board.</p>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search clubs or categories"
        style={{ width:"100%", maxWidth:420, padding:"10px 13px", fontSize:15, border:"1px solid var(--line)", borderRadius:10,
        background:"var(--card)", outline:"none", marginBottom:18 }} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
        {list.map(c => (
          <button key={c.name} onClick={()=>onOpenClub(c.name)} style={{ textAlign:"left", background:"var(--card)", border:"1px solid var(--line)",
            borderRadius:14, padding:18, boxShadow:"var(--shadow)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
              <Avatar name={c.name} />
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{c.name}</div>
                <div style={{ fontSize:13.5, color:"var(--ink-faint)" }}>{c.category} · {c.eboard.length} e-board members</div>
              </div>
            </div>
            <div style={{ fontSize:14, color:"var(--ink-soft)" }}>{c.bio}</div>
          </button>
        ))}
        {list.length===0 && <div style={{ color:"var(--ink-faint)", fontSize:15 }}>No clubs match that search.</div>}
      </div>
    </main>
  );
}
