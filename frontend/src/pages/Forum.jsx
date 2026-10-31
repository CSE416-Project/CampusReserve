import OrgLink from '../components/OrgLink.jsx';
import { useState } from 'react';

const CATS = [["collaboration","Collaboration"],["resource_share","Resource share"],["general","General"]];
const catLabel = id => (CATS.find(c => c[0] === id) || CATS[2])[1];
const box = { width:"100%", padding:"9px 11px", fontSize:16.2, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)", outline:"none", color:"var(--ink)" };

export default function Forum({ posts, onPost, onReply, clubs = [], loading = false, error = "", onOpenClub }) {
  const [title,setTitle]=useState(""); const [body,setBody]=useState(""); const [category,setCategory]=useState("general");
  const [postAsSel,setPostAs]=useState("");
  const postAs = clubs.includes(postAsSel) ? postAsSel : (clubs[0] || "");
  const [filter,setFilter]=useState("all");
  const [replyDraft,setReplyDraft]=useState({}); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const shown = posts.filter(p => filter === "all" || p.category === filter);
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(false); };
  const canPost = title.trim() && body.trim() && !busy;
  return (
    <main className="page" style={{ maxWidth:760, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:30, fontWeight:800, marginBottom:18 }}>Collaboration forum</h1>

      <div style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, marginBottom:20 }}>
        <input id="post-title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Post title" style={{ ...box, marginBottom:8 }} />
        <textarea id="post-body" value={body} onChange={e=>setBody(e.target.value)} placeholder="What are you proposing or looking for?" rows={3} style={{ ...box, resize:"vertical" }} />
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginTop:10 }}>
          <select id="post-category" value={category} onChange={e=>setCategory(e.target.value)} style={{ ...box, width:"auto", fontSize:15 }}>
            {CATS.map(([id,l])=><option key={id} value={id}>{l}</option>)}
          </select>
          {clubs.length>0 && (
            <select id="post-as" value={postAs} onChange={e=>setPostAs(e.target.value)} aria-label="Post as" style={{ ...box, width:"auto", fontSize:15 }}>
              {clubs.map(c=><option key={c} value={c}>Posting as {c}</option>)}
            </select>
          )}
          <button disabled={!canPost} onClick={()=>run(async()=>{ await onPost({ title:title.trim(), body:body.trim(), category, org:postAs || "" }); setTitle(""); setBody(""); })}
            style={{ marginLeft:"auto", padding:"9px 16px", borderRadius:8, fontSize:16.2, fontWeight:600, color:"var(--ink)",
            background: canPost?"var(--blue)":"var(--line-soft)" }}>{busy ? "Posting…" : "Post to forum"}</button>
        </div>
        {(err || error) && <div role="alert" style={{ color:"var(--red)", fontWeight:600, fontSize:14.5, marginTop:10 }}>{err || error}</div>}
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {[["all","All"],...CATS].map(([id,l])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ padding:"7px 14px", borderRadius:999, fontSize:14.5, fontWeight:600, border:"2px solid var(--ink)",
            color:"var(--ink)", background: filter===id?"var(--blue)":"var(--card)" }}>{l}</button>
        ))}
      </div>

      <div style={{ display:"grid", gap:14 }}>
        {loading && <div style={{ color:"var(--ink-faint)", fontSize:15 }}>Loading posts…</div>}
        {!loading && shown.length===0 && <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No posts yet. Start the conversation above.</div>}
        {shown.map(p => (
          <div key={p.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:18 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", fontSize:15, color:"var(--ink-faint)", fontWeight:600, marginBottom:4 }}>
              <span>{p.author}{p.org && <> · <OrgLink name={p.org} onOpen={onOpenClub} /></>}</span>
              <span style={{ fontSize:12.5, padding:"2px 9px", borderRadius:999, background:"var(--slate-wash)", color:"var(--ink-soft)" }}>{catLabel(p.category)}</span>
            </div>
            <div style={{ fontWeight:700, fontSize:19.2, marginBottom:6 }}>{p.title}</div>
            <div style={{ fontSize:16.2, color:"var(--ink-soft)", marginBottom:12, whiteSpace:"pre-wrap" }}>{p.body}</div>
            {p.replies.length>0 && (
              <div style={{ display:"grid", gap:8, marginBottom:12 }}>
                {p.replies.map((r,i) => (
                  <div key={i} style={{ background:"var(--paper)", borderRadius:8, padding:"8px 12px", fontSize:15.6 }}>
                    <b>{r.author}{r.org && <span style={{ fontWeight:500, color:"var(--ink-faint)" }}> · <OrgLink name={r.org} onOpen={onOpenClub} /></span>}:</b> {r.text}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <input value={replyDraft[p.id]||""} onChange={e=>setReplyDraft(d=>({...d,[p.id]:e.target.value}))}
                placeholder="Reply…" aria-label="Write a reply" style={{ ...box, flex:1, minWidth:0, fontSize:15.6, padding:"8px 11px" }} />
              <button disabled={busy || !(replyDraft[p.id]||"").trim()} onClick={()=>run(async()=>{ await onReply(p.id,replyDraft[p.id].trim(),postAs || ""); setReplyDraft(d=>({...d,[p.id]:""})); })}
                style={{ padding:"8px 14px", borderRadius:8, fontSize:15.6, fontWeight:600, color:"var(--link)" }}>Reply</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
