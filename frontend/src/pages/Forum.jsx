import OrgLink from '../components/OrgLink.jsx';
import { useState } from 'react';

export default function Forum({ posts, onPost, onReply, selfName, onOpenClub }) {
  const [title,setTitle]=useState(""); const [body,setBody]=useState("");
  const [replyDraft,setReplyDraft]=useState({});
  return (
    <main style={{ maxWidth:760, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:30, fontWeight:800, marginBottom:6 }}>Collaboration forum</h1>
      <p style={{ fontSize:16.8, color:"var(--ink-soft)", marginBottom:20 }}>Propose collaborations, or offer and request shared resources and storage.</p>

      <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, padding:16, marginBottom:20 }}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Post title"
          style={{ width:"100%", padding:"9px 11px", fontSize:16.2, border:"1px solid var(--line)", borderRadius:9,
          background:"var(--paper)", marginBottom:8, outline:"none" }} />
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="What are you proposing or looking for?"
          rows={3} style={{ width:"100%", padding:"9px 11px", fontSize:16.2, border:"1px solid var(--line)", borderRadius:9,
          background:"var(--paper)", resize:"vertical", outline:"none" }} />
        <button disabled={!title.trim() || !body.trim()} onClick={()=>{ onPost(title,body); setTitle(""); setBody(""); }}
          style={{ marginTop:10, padding:"9px 16px", borderRadius:9, fontSize:16.2, fontWeight:600, color:"#fff",
          background: (title.trim()&&body.trim())?"var(--blue)":"var(--slate)" }}>Post to forum</button>
      </div>

      <div style={{ display:"grid", gap:14 }}>
        {posts.map(p => (
          <div key={p.id} style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, padding:18 }}>
            <div style={{ fontSize:15, color:"var(--ink-faint)", fontWeight:600, marginBottom:4 }}><OrgLink name={p.org} onOpen={onOpenClub} /></div>
            <div style={{ fontWeight:700, fontSize:19.2, marginBottom:6 }}>{p.title}</div>
            <div style={{ fontSize:16.2, color:"var(--ink-soft)", marginBottom:12 }}>{p.body}</div>
            {p.replies.length>0 && (
              <div style={{ display:"grid", gap:8, marginBottom:12 }}>
                {p.replies.map((r,i) => (
                  <div key={i} style={{ background:"var(--paper)", borderRadius:9, padding:"8px 12px", fontSize:15.6 }}>
                    <b><OrgLink name={r.org} onOpen={onOpenClub} />:</b> {r.text}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <input value={replyDraft[p.id]||""} onChange={e=>setReplyDraft(d=>({...d,[p.id]:e.target.value}))}
                placeholder="Reply…" style={{ flex:1, padding:"8px 11px", fontSize:15.6, border:"1px solid var(--line)",
                borderRadius:8, background:"var(--paper)", outline:"none" }} />
              <button disabled={!(replyDraft[p.id]||"").trim()} onClick={()=>{ onReply(p.id,replyDraft[p.id]); setReplyDraft(d=>({...d,[p.id]:""})); }}
                style={{ padding:"8px 14px", borderRadius:8, fontSize:15.6, fontWeight:600, color:"var(--blue)" }}>Reply</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
