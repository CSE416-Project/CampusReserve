import { useState, useMemo, useEffect } from 'react';
import { getDays, slotState } from '../data/mock.js';
import Pill from '../components/Pill.jsx';

export default function BookingDrawer({ room, onClose, onSubmit, orgs = [] }) {
  const days = useMemo(() => getDays(14), []);
  const [dayKey, setDayKey] = useState(days[0].key);
  const [picks, setPicks] = useState([]);
  const [done, setDone] = useState(false);
  const [org, setOrg] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 1300);
    return () => clearTimeout(t);
  }, [done]);

  if (!room) return null;

  const day = days.find(d => d.key === dayKey);
  const isPicked = t => picks.some(p => p.key === dayKey && p.time === t);
  const toggle = t => setPicks(ps => isPicked(t)
    ? ps.filter(p => !(p.key === dayKey && p.time === t))
    : [...ps, { key: dayKey, label: day.label, time: t }]);
  const remove = p => setPicks(ps => ps.filter(x => x !== p));
  const needOrg = orgs.length > 1 && !org;
  const bookingOrg = orgs.length > 1 ? org : orgs[0];
  const sorted = [...picks].sort((a, b) => a.key.localeCompare(b.key) || parseInt(a.time) - parseInt(b.time));

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(27,42,74,.28)", zIndex:40 }} />
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:480, maxWidth:"94vw", background:"var(--card)",
        zIndex:50, boxShadow:"-8px 0 40px rgba(27,42,74,.18)", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px 22px", borderBottom:"1px solid var(--line)" }}>
          <Pill status={room.status} small />
          <h2 style={{ fontSize:24, fontWeight:800, margin:"10px 0 3px" }}>{room.name}</h2>
          <div style={{ fontSize:15.6, color:"var(--ink-faint)" }}>{room.building} · Holds {room.cap}</div>
          <button onClick={onClose} aria-label="Close" style={{ position:"absolute", top:18, right:20, width:30, height:30,
            borderRadius:8, background:"var(--line-soft)" }}>×</button>
        </div>

        <div style={{ padding:"18px 22px", overflowY:"auto", flex:1 }}>
          {confirming && (
            <div>
              <div style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Confirm your request</div>
              <div style={{ fontSize:15, color:"var(--ink-soft)", marginBottom:14 }}>Please check the details. Nothing is sent until you confirm.</div>
              <div style={{ border:"2px solid var(--ink)", borderRadius:10, padding:"14px 16px", background:"var(--paper)" }}>
                <div style={{ fontWeight:700, fontSize:17 }}>{room.name}</div>
                <div style={{ fontSize:14, color:"var(--ink-faint)", marginBottom:8 }}>{room.building}</div>
                {bookingOrg && <div style={{ fontSize:15, marginBottom:6 }}>Booking for: <b>{bookingOrg}</b></div>}
                {sorted.map(p => <div key={p.key + p.time} style={{ fontSize:15, padding:"3px 0" }}>{p.label} · {p.time}</div>)}
              </div>
            </div>
          )}
          <div style={{ display: confirming ? "none" : "block" }}>
          {orgs.length > 1 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:15.6, fontWeight:700, marginBottom:8 }}>Booking for which club?</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {orgs.map(o => (
                  <button key={o} onClick={() => setOrg(o)} style={{ padding:"9px 15px", borderRadius:999, fontSize:15, fontWeight:700,
                    border:"2px solid var(--ink)", color:"var(--ink)", background: org === o ? "var(--blue)" : "var(--card)" }}>{o}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize:15.6, fontWeight:700, marginBottom:10 }}>Choose days — you can book more than one</div>
          <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"8px 6px 10px 0", marginBottom:10 }}>
            {days.map(d => {
              const sel = d.key === dayKey; const n = picks.filter(p => p.key === d.key).length;
              return (
                <button key={d.key} onClick={() => setDayKey(d.key)} style={{ flexShrink:0, width:62, padding:"8px 0",
                  borderRadius:10, textAlign:"center", position:"relative",
                  border:`1.5px solid ${sel ? "var(--blue)" : "var(--line)"}`,
                  background: sel ? "var(--blue)" : "var(--card)", color: sel ? "var(--ink)" : "var(--ink)" }}>
                  <div style={{ fontSize:13.8, fontWeight:600, opacity:.8 }}>{d.dow}</div>
                  <div style={{ fontSize:21.6, fontWeight:700 }}>{d.num}</div>
                  {n > 0 && <span style={{ position:"absolute", top:-6, right:-6, minWidth:18, height:18, borderRadius:999,
                    background:"var(--mint)", color:"var(--ink)", fontSize:13.2, fontWeight:700, display:"grid", placeItems:"center" }}>{n}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize:15.6, fontWeight:700, margin:"6px 0 10px" }}>Pick times — {day.label}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {room.slots.map(s => {
              const st = slotState(room, dayKey, s); const on = isPicked(s);
              return (
                <button key={s} disabled={st !== "open"} onClick={() => toggle(s)} style={{
                  padding:"11px 4px", borderRadius:8, fontSize:16.2, fontWeight:600,
                  border:`1.5px solid ${on ? "var(--blue)" : st === "open" ? "var(--line)" : "transparent"}`,
                  background: on ? "var(--blue)" : st === "open" ? "var(--card)" : st === "requested" ? "var(--amber-wash)" : "var(--slate-wash)",
                  color: on ? "var(--ink)" : st === "open" ? "var(--ink)" : st === "requested" ? "var(--amber)" : "var(--slate)",
                  cursor: st === "open" ? "pointer" : "not-allowed" }}>
                  {s}
                  {st !== "open" && <div style={{ fontSize:12 }}>{st === "taken" ? "booked" : "requested"}</div>}
                </button>
              );
            })}
          </div>

          {sorted.length > 0 && (
            <div style={{ background:"var(--blue-wash)", borderRadius:10, padding:"13px 15px", marginTop:18 }}>
              <div style={{ fontSize:15.6, fontWeight:700, marginBottom:8 }}>Your selection ({sorted.length})</div>
              {sorted.map(p => (
                <div key={p.key + p.time} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  fontSize:16.2, padding:"4px 0", color:"var(--ink-soft)" }}>
                  <span><b style={{ color:"var(--ink)" }}>{p.label}</b> · {p.time}</span>
                  <button onClick={() => remove(p)} aria-label="Remove" style={{ fontSize:19.2, color:"var(--ink-faint)" }}>×</button>
                </div>
              ))}
              <div style={{ fontSize:15, color:"var(--ink-faint)", marginTop:6 }}>Setup & cleanup time can be added on the next step.</div>
            </div>
          )}
          </div>
        </div>

        <div style={{ padding:"16px 22px", borderTop:"1px solid var(--line)", background:"var(--paper)" }}>
          {done ? (
            <div style={{ color:"var(--green)", fontWeight:600, fontSize:16.8, textAlign:"center" }}>
              ✓ {picks.length} request{picks.length === 1 ? "" : "s"} sent — you'll get a notification when reviewed
            </div>
          ) : confirming ? (
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirming(false)} style={{ flex:1, padding:"13px", borderRadius:10, fontSize:16, fontWeight:700,
                border:"2px solid var(--ink)", background:"var(--card)" }}>Back</button>
              <button onClick={() => { onSubmit(room, sorted, bookingOrg); setDone(true); }} style={{ flex:2, padding:"13px", borderRadius:10,
                fontSize:16, fontWeight:700, color:"var(--ink)", background:"var(--blue)" }}>Confirm request</button>
            </div>
          ) : (
            <button disabled={!picks.length || needOrg} onClick={() => setConfirming(true)} style={{
              width:"100%", padding:"13px", borderRadius:10, fontSize:18, fontWeight:700, color:"var(--ink)",
              background: (picks.length && !needOrg) ? "var(--blue)" : "var(--line-soft)" }}>
              {needOrg ? "Choose a club to continue" : picks.length ? `Review ${picks.length} time${picks.length === 1 ? "" : "s"}` : "Pick a time to continue"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
