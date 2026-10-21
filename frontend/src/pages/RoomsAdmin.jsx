import { useState } from 'react';
import { ROOMS, BUILDINGS, upcomingEvents } from '../data/mock.js';
import Pill from '../components/Pill.jsx';

// rooms/requests come from the server when the app is connected to it (live);
// otherwise the sample data is used for the demo.
export default function RoomsAdmin({ rooms, requests = [], loading = false }) {
  const live = !!rooms && rooms.some(r => r.live);
  const roomList = live ? rooms : ROOMS;
  const buildingList = live ? ["All buildings", ...[...new Set(roomList.map(r => r.building))].sort()] : BUILDINGS;
  const [building,setBuilding]=useState("All buildings");
  const groups = buildingList.slice(1)
    .filter(b => building==="All buildings" || b===building)
    .map(b => ({ building:b, rooms:roomList.filter(r=>r.building===b) }))
    .filter(g => g.rooms.length>0);
  const eventsFor = r => live
    ? requests.filter(q => q.room?.id===r.id && (q.status==="approved" || q.status==="pending"))
        .map(q => ({ org:q.org, title:q.event || "Booking", date:q.date, time:q.time }))
    : upcomingEvents(r);

  return (
    <main style={{ maxWidth:1000, margin:"0 auto", padding:"26px 24px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12, marginBottom:6 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Rooms</h1>
        </div>
        <select value={building} onChange={e=>setBuilding(e.target.value)} style={{ padding:"9px 12px", fontSize:14.5,
          border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }}>
          {buildingList.map(b=><option key={b}>{b}</option>)}
        </select>
      </div>

      {loading && <div style={{ marginTop:26, color:"var(--ink-faint)" }}>Loading rooms…</div>}
      {!loading && groups.length===0 && (
        <div style={{ marginTop:26, textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No rooms found.</div>
      )}
      {groups.map(g => (
        <div key={g.building} style={{ marginTop:26 }}>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:12, color:"var(--ink)" }}>{g.building}</div>
          <div style={{ display:"grid", gap:14 }}>
            {g.rooms.map(r => {
              const events = eventsFor(r);
              return (
                <div key={r.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:16 }}>{r.name}</div>
                      <div style={{ fontSize:14, color:"var(--ink-faint)" }}>Holds {r.cap} · {r.type}</div>
                    </div>
                    <Pill status={r.status} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)", marginBottom:6 }}>
                    {events.length} upcoming event{events.length===1?"":"s"}
                  </div>
                  {events.length>0 && (
                    <div style={{ display:"grid", gap:5 }}>
                      {events.slice(0,4).map((e,i)=>(
                        <div key={i} style={{ fontSize:13.5, color:"var(--ink-soft)", background:"var(--paper)", borderRadius:8, padding:"7px 11px" }}>
                          <b>{e.org}</b> · {e.title} · {e.date} · {e.time}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
