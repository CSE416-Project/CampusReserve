import OrgLink from '../components/OrgLink.jsx';
import { ROOMS, VENUE_HOST_BUILDINGS } from '../data/mock.js';
import Pill from '../components/Pill.jsx';

export default function VenueRooms({ requests, onOpenClub }) {
  const rooms = ROOMS.filter(r => VENUE_HOST_BUILDINGS.includes(r.building));
  return (
    <main style={{ maxWidth:1000, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>Rooms you manage</h1>
      <div style={{ display:"grid", gap:14 }}>
        {rooms.map(r => {
          const bookings = requests.filter(req => req.room.id===r.id);
          return (
            <div key={r.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{r.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{r.building} · Holds {r.cap}</div>
                </div>
                <Pill status={r.status} />
              </div>
              {bookings.length===0 ? (
                <div style={{ fontSize:14, color:"var(--ink-faint)" }}>No reservations yet.</div>
              ) : (
                <div style={{ display:"grid", gap:6 }}>
                  {bookings.map(b => (
                    <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--paper)",
                      borderRadius:8, padding:"8px 12px" }}>
                      <span style={{ fontSize:14 }}><b><OrgLink name={b.org} onOpen={onOpenClub} /></b> · {b.date} · {b.time}</span>
                      <Pill status={b.status} small />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
