import { useState, useEffect } from 'react';
import { CONTACTS } from '../data/mock.js';

export default function Messages({ threads, onSend, onStartChat, activeId, setActiveId, selfName, unreadMap = {} }) {
  const mine = threads.filter(t => t.participants.includes(selfName));
  useEffect(() => { if (activeId==null && mine[0]) setActiveId(mine[0].id); }, [selfName]);
  const [draft,setDraft]=useState("");
  const [search,setSearch]=useState("");
  const active = mine.find(t=>t.id===activeId);
  const other = t => t.participants.find(p => p !== selfName);

  const results = search.trim()
    ? CONTACTS.filter(c => c !== selfName && c.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <main style={{ maxWidth:1000, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>Messages</h1>
      <p style={{ fontSize:15, color:"var(--ink-soft)", marginBottom:20 }}>
        Private, one-on-one conversations — only you and the other person can see a thread.
      </p>
      <div style={{ display:"flex", gap:18, alignItems:"flex-start", flexWrap:"wrap" }}>
        <div style={{ width:270, flexShrink:0, background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:12, borderBottom:"1px solid var(--line)", position:"relative" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people to message…"
              style={{ width:"100%", padding:"8px 11px", fontSize:14, border:"1px solid var(--line)", borderRadius:9,
              background:"var(--paper)", outline:"none" }} />
            {results.length>0 && (
              <div style={{ position:"absolute", left:12, right:12, top:52, background:"var(--card)", border:"1px solid var(--line)",
                borderRadius:9, boxShadow:"var(--shadow-lift)", zIndex:5, overflow:"hidden" }}>
                {results.map(c => (
                  <button key={c} onClick={()=>{ onStartChat(c); setSearch(""); }} style={{ display:"block", width:"100%",
                    textAlign:"left", padding:"9px 12px", fontSize:14, borderBottom:"1px solid var(--line-soft)" }}>{c}</button>
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
              <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:2 }}>{t.subject}</div>
            </button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:280, background:"var(--card)", border:"1px solid var(--line)", borderRadius:14,
          display:"flex", flexDirection:"column", minHeight:360 }}>
          {!active ? (
            <div style={{ margin:"auto", color:"var(--ink-faint)", fontSize:14.5, padding:30, textAlign:"center" }}>Pick a conversation, or search for someone to message.</div>
          ) : (
            <>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--line)", fontWeight:700, fontSize:15 }}>
                {other(active)} <span style={{ fontWeight:500, color:"var(--ink-faint)", fontSize:13 }}>· {active.subject}</span>
              </div>
              <div style={{ flex:1, padding:18, overflowY:"auto", display:"flex", flexDirection:"column", gap:10 }}>
                {active.messages.length===0 && <div style={{ margin:"auto", color:"var(--ink-faint)", fontSize:14 }}>Say hello to start the conversation.</div>}
                {active.messages.map((m,i) => {
                  const mine2 = m.from===selfName;
                  return (
                    <div key={i} style={{ maxWidth:"75%", alignSelf: mine2?"flex-end":"flex-start" }}>
                      <div style={{ fontSize:12, color:"var(--ink-faint)", marginBottom:3, textAlign: mine2?"right":"left" }}>{m.from} · {m.time}</div>
                      <div style={{ padding:"9px 13px", borderRadius:12, fontSize:14.5,
                        background: mine2?"var(--blue-wash)":"var(--line-soft)", color:"var(--ink)" }}>{m.text}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding:14, borderTop:"1px solid var(--line)", display:"flex", gap:8 }}>
                <input value={draft} onChange={e=>setDraft(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter" && draft.trim()){ onSend(active.id,draft); setDraft(""); } }}
                  placeholder="Write a message…" style={{ flex:1, padding:"10px 13px", fontSize:14.5,
                  border:"1px solid var(--line)", borderRadius:9, background:"var(--paper)", outline:"none" }} />
                <button disabled={!draft.trim()} onClick={()=>{ onSend(active.id,draft); setDraft(""); }} style={{
                  padding:"10px 16px", borderRadius:9, fontSize:14.5, fontWeight:600, color: draft.trim()?"var(--blue)":"var(--ink-faint)",
                  background: draft.trim()?"var(--blue-wash)":"var(--line-soft)" }}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
