import { useState, useEffect } from 'react';

export default function Messages({ threads, onSend, onStartChat, activeId, setActiveId, selfId, onSearchPeople, unreadMap = {} }) {
  const mine = threads.filter(t => t.participants.some(p => p.id === selfId));
  useEffect(() => { if (activeId==null && mine[0]) setActiveId(mine[0].id); }, [selfId, mine.length]);
  const [draft,setDraft]=useState("");
  const [search,setSearch]=useState("");
  const active = mine.find(t=>t.id===activeId);
  const other = t => t.participants.find(p => p.id !== selfId)?.name || "Former user";

  // search people (not clubs) to start a chat with
  const [results,setResults]=useState([]); const [searchErr,setSearchErr]=useState("");
  useEffect(()=>{
    if (!search.trim()) { setResults([]); setSearchErr(""); return; }
    let off=false;
    const t=setTimeout(()=>{ onSearchPeople(search.trim())
      .then(r=>{ if(!off){ setResults(r.filter(c=>c.id!==selfId).slice(0,8)); setSearchErr(""); } })
      .catch(e=>{ if(!off){ setResults([]); setSearchErr(e.message); } }); },200);
    return ()=>{ off=true; clearTimeout(t); };
  },[search]);

  return (
    <main style={{ maxWidth:1000, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Messages</h1>
      <div style={{ display:"flex", gap:18, alignItems:"flex-start", flexWrap:"wrap" }}>
        <div style={{ width:270, flexShrink:0, background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:12, borderBottom:"1px solid var(--line)", position:"relative" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people by name…"
              style={{ width:"100%", padding:"8px 11px", fontSize:14, border:"2px solid var(--ink)", borderRadius:8,
              background:"var(--paper)", outline:"none" }} />
            {searchErr && <div style={{ fontSize:13, color:"var(--red)", marginTop:6 }}>{searchErr}</div>}
            {search.trim() && !searchErr && results.length===0 && (
              <div style={{ position:"absolute", left:12, right:12, top:52, background:"var(--card)", border:"2px solid var(--ink)", borderRadius:8,
                padding:"9px 12px", fontSize:14, color:"var(--ink-faint)", zIndex:5 }}>No people found</div>
            )}
            {results.length>0 && (
              <div style={{ position:"absolute", left:12, right:12, top:52, background:"var(--card)", border:"2px solid var(--ink)",
                borderRadius:8, boxShadow:"var(--shadow-lift)", zIndex:5, overflow:"hidden" }}>
                {results.map(c => (
                  <button key={c.id} onClick={()=>{ onStartChat(c); setSearch(""); }} style={{ display:"block", width:"100%",
                    textAlign:"left", padding:"9px 12px", fontSize:14, color:"var(--ink)", borderBottom:"1px solid var(--line-soft)" }}>
                    <span style={{ display:"block", fontWeight:600 }}>{c.name}</span>
                    {(c.sub || c.email) && <span style={{ display:"block", fontSize:12.5, color:"var(--ink-faint)" }}>{c.sub || c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {mine.length===0 ? (
            <div style={{ padding:16, fontSize:14, color:"var(--ink-faint)" }}>No conversations yet — search above to start one.</div>
          ) : mine.map(t => (
            <button key={t.id} onClick={()=>setActiveId(t.id)} style={{ display:"block", width:"100%", textAlign:"left",
              padding:"13px 15px", borderBottom:"1px solid var(--line-soft)",
              background: t.id===activeId?"var(--blue-wash)":"transparent" }}>
              <div style={{ fontWeight:700, fontSize:14.5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>{other(t)}</span>
                {unreadMap[t.id]>0 && <span style={{ minWidth:20, height:20, padding:"0 6px", borderRadius:999, background:"var(--red-wash)", color:"var(--red)",
                  fontSize:12, fontWeight:700, display:"grid", placeItems:"center" }}>{unreadMap[t.id]}</span>}
              </div>
              {t.subject && <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:2 }}>{t.subject}</div>}
            </button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:280, background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14,
          display:"flex", flexDirection:"column", minHeight:360 }}>
          {!active ? (
            <div style={{ margin:"auto", color:"var(--ink-faint)", fontSize:14.5, padding:30, textAlign:"center" }}>Pick a conversation, or search for someone to message.</div>
          ) : (
            <>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--line)", fontWeight:700, fontSize:15 }}>
                {other(active)}{active.subject && <span style={{ fontWeight:500, color:"var(--ink-faint)", fontSize:13 }}> · {active.subject}</span>}
              </div>
              <div style={{ flex:1, padding:18, overflowY:"auto", display:"flex", flexDirection:"column", gap:10 }}>
                {active.messages.length===0 && <div style={{ margin:"auto", color:"var(--ink-faint)", fontSize:14 }}>Say hello to start the conversation.</div>}
                {active.messages.map((m,i) => {
                  const mine2 = m.fromId===selfId;
                  return (
                    <div key={m.id ?? i} style={{ maxWidth:"75%", alignSelf: mine2?"flex-end":"flex-start" }}>
                      <div style={{ fontSize:12, color:"var(--ink-faint)", marginBottom:3, textAlign: mine2?"right":"left" }}>{m.from} · {m.time}</div>
                      <div style={{ padding:"9px 13px", borderRadius:10, fontSize:14.5,
                        background: mine2?"var(--blue-wash)":"var(--line-soft)", color:"var(--ink)" }}>{m.text}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:14, borderTop:"1px solid var(--line)", display:"flex", gap:8 }}>
                <input value={draft} onChange={e=>setDraft(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter" && draft.trim()){ onSend(active.id,draft); setDraft(""); } }}
                  placeholder="Write a message…" style={{ flex:1, padding:"10px 13px", fontSize:14.5,
                  border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)", outline:"none" }} />
                <button disabled={!draft.trim()} onClick={()=>{ onSend(active.id,draft); setDraft(""); }} style={{
                  padding:"10px 16px", borderRadius:8, fontSize:14.5, fontWeight:600, color: draft.trim()?"var(--link)":"var(--ink-faint)",
                  background: draft.trim()?"var(--blue-wash)":"var(--line-soft)" }}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
