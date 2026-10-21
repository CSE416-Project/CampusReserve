import { useState } from 'react';
import { roomNotes, upcomingEvents } from '../data/mock.js';
import Pill from '../components/Pill.jsx';
import Feature from '../components/Feature.jsx';

export default function RoomDetail({ room, onBack, onBook }) {
  const notes = roomNotes(room);
  const [comments, setComments] = useState(notes.comments);
  const [draft, setDraft] = useState("");
  const events = upcomingEvents(room);

  return (
    <main style={{ maxWidth:1180, margin:"0 auto", padding:"28px 30px 70px" }}>
      <button onClick={onBack} style={{ fontSize:18, fontWeight:600, color:"var(--link)", marginBottom:14 }}>‹ Back to search</button>

      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:18 }}>
        <div>
          <Pill status={room.status} small />
          <h1 style={{ fontSize:34, fontWeight:800, margin:"10px 0 4px" }}>{room.name}</h1>
          <div style={{ fontSize:19, color:"var(--ink-faint)" }}>{room.building} · Holds {room.cap} · {room.type}</div>
        </div>
        {!room.closed && (
          <button onClick={()=>onBook(room)} style={{ padding:"12px 22px", borderRadius:10, fontSize:19, fontWeight:700,
            color:"var(--ink)", background:"var(--blue)", height:"fit-content" }}>Book this room</button>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:32, alignItems:"start" }}>
        <div>
          <div style={{ fontSize:19, fontWeight:700, marginBottom:10 }}>3D model preview</div>
          <div style={{ height:280, borderRadius:18, marginBottom:28, position:"relative",
            background:"linear-gradient(135deg, #FFC93C 0%, #FF9B7A 100%)", display:"grid", placeItems:"center" }}>
            <div style={{ textAlign:"center", color:"var(--ink)" }}>
              <div style={{ fontSize:42, marginBottom:6 }}>⟳</div>
              <div style={{ fontSize:18, fontWeight:600 }}>3D model coming soon</div>
              <div style={{ fontSize:16, opacity:.8 }}>Venue hosts will be able to upload a scanned model here</div>
            </div>
          </div>

          <div style={{ fontSize:19, fontWeight:700, marginBottom:10 }}>What's in this room</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:22 }}>
            {room.features.map(f=><Feature key={f}>{f}</Feature>)}
          </div>

          <div style={{ fontSize:19, fontWeight:700, marginBottom:10 }}>Instructions</div>
          <div style={{ fontSize:18, color:"var(--ink-soft)", background:"var(--paper)", padding:"18px 20px",
            borderRadius:14, marginBottom:28, lineHeight:1.65 }}>{notes.instructions}</div>

          <div style={{ fontSize:19, fontWeight:700, marginBottom:10 }}>Comments from other clubs</div>
          <div style={{ display:"grid", gap:8, marginBottom:12 }}>
            {comments.map((c,i)=>(
              <div key={i} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:10, padding:"13px 16px", fontSize:18 }}>
                <b>{c.org}:</b> {c.text}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Add a comment or tip for other clubs…"
              style={{ flex:1, padding:"15px 18px", fontSize:18, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)", outline:"none" }} />
            <button disabled={!draft.trim()} onClick={()=>{ setComments(c=>[...c,{org:"Robotics Club",text:draft}]); setDraft(""); }}
              style={{ padding:"12px 20px", borderRadius:8, fontSize:18, fontWeight:600, color:"var(--ink)",
              background: draft.trim()?"var(--blue)":"var(--line-soft)" }}>Post</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize:19, fontWeight:700, marginBottom:10 }}>Other events in this room</div>
          <div style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, overflow:"hidden" }}>
            {events.length===0 ? (
              <div style={{ padding:16, fontSize:18, color:"var(--ink-faint)" }}>No upcoming events scheduled.</div>
            ) : events.map((e,i)=>(
              <div key={i} style={{ padding:"12px 15px", borderBottom: i<events.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontWeight:700, fontSize:18 }}>{e.org}</div>
                <div style={{ fontSize:16, color:"var(--ink-faint)" }}>{e.title} · {e.date} · {e.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
