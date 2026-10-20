import { useState } from 'react';
import { CLUBS } from '../data/mock.js';
import Avatar from '../components/Avatar.jsx';

const CATEGORIES = [...new Set(CLUBS.map(c => c.category))].sort();

export default function Clubs({ onOpenClub }) {
  const [q,setQ]=useState(""); const [cats,setCats]=useState([]);
  const toggle = c => setCats(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const list = CLUBS.filter(c => (cats.length === 0 || cats.includes(c.category))
    && `${c.name} ${c.category} ${c.bio}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <main style={{ maxWidth:1100, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Clubs</h1>
      <div style={{ display:"flex", gap:24, alignItems:"flex-start", flexWrap:"wrap" }}>
        <aside style={{ width:260, flexShrink:0, background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:18, boxShadow:"var(--shadow)" }}>
          <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Search</label>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Club name or keyword"
            style={{ width:"100%", margin:"6px 0 16px", padding:"9px 11px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:10, background:"var(--paper)", outline:"none" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
            <label style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>Category{cats.length > 0 && ` (${cats.length})`}</label>
            {cats.length > 0 && <button onClick={()=>setCats([])} style={{ fontSize:13, fontWeight:600, color:"var(--link)" }}>Clear</button>}
          </div>
          {CATEGORIES.map(c => (
            <label key={c} style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 0", fontSize:14.5, cursor:"pointer" }}>
              <input type="checkbox" checked={cats.includes(c)} onChange={()=>toggle(c)} style={{ accentColor:"var(--ink)" }} />
              <span style={{ flex:1 }}>{c}</span>
              <span style={{ fontSize:13, color:"var(--ink-faint)" }}>{CLUBS.filter(x => x.category === c).length}</span>
            </label>
          ))}
        </aside>

        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ fontSize:14, color:"var(--ink-faint)", fontWeight:600, marginBottom:12 }}>{list.length} {list.length === 1 ? "club" : "clubs"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
            {list.map(c => (
              <button key={c.name} onClick={()=>onOpenClub(c.name)} style={{ textAlign:"left", background:"var(--card)", border:"2px solid var(--ink)",
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
            {list.length === 0 && <div style={{ color:"var(--ink-faint)", fontSize:15 }}>No clubs match those filters.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
