import { useState, useMemo } from 'react';
import { SB_ENGAGED_URL } from '../data/mock.js';
import Pill from '../components/Pill.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import WeekCalendar, { CalendarLegend, startOfWeek } from '../components/WeekCalendar.jsx';

let saved = null;
try { saved = localStorage.getItem("cr_requests_view"); } catch { /* storage unavailable */ }

// How each request status looks on the calendar (colours come from the shared calendar legend).
const KIND_OF = { approved: "approved", pending: "pending", waitlisted: "waitlist", denied: "denied", cancelled: "cancelled" };

export default function MyRequests({ requests, showOrg = false, clubs = [], onCancel }) {
  const [status,setStatus]=useState("All"); const [q,setQ]=useState("");
  const buildings = ["All buildings", ...new Set(requests.map(r=>r.room.building))];
  const [building,setBuilding]=useState("All buildings");
  const [asking,setAsking]=useState(null); const [busy,setBusy]=useState(null);
  const [view,setViewState]=useState(saved==="calendar" ? "calendar" : "list");
  const setView = v => { setViewState(v); try { localStorage.setItem("cr_requests_view", v); } catch { /* ignore */ } };
  const cancel = async id => { setBusy(id); try { await onCancel(id); } catch { /* error banner is shown by the app */ } setBusy(null); setAsking(null); };

  const filtered = useMemo(()=>requests.filter(r=>{
    if (status!=="All" && r.status!==status) return false;
    if (building!=="All buildings" && r.room.building!==building) return false;
    if (q && !r.room.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }),[requests,status,building,q]);

  // Calendar view: every request that has a date and time, coloured by status. Opens on the next upcoming one.
  const events = useMemo(() => filtered.filter(r => r.startAt && r.endAt).map(r => ({
    id: String(r.id), start: r.startAt, end: r.endAt, title: r.event || r.room.name,
    sub: [r.room.name, showOrg ? r.org : null].filter(Boolean).join(" · "), kind: KIND_OF[r.status] || "pending",
    details: [["Room", `${r.room.name} · ${r.room.building}`], ...(showOrg || r.org ? [["Club", r.org]] : []),
      ...(r.status === "waitlisted" ? [["Waitlist", `Spot #${r.position || "–"} in line`]] : []),
      ...(r.status === "denied" && r.reason ? [["Reason", r.reason]] : [])],
  })), [filtered, showOrg]);
  const undated = filtered.length - events.length;
  const [weekStart,setWeekStart]=useState(() => {
    const now = new Date();
    const next = requests.filter(r => r.startAt && r.endAt > now && !["denied","cancelled"].includes(r.status)).sort((a,b) => a.startAt - b.startAt)[0];
    return startOfWeek(next ? next.startAt : now);
  });
  const shownKinds = ["approved","pending","waitlist","denied","cancelled"];

  return (
    <main className="page" style={{ maxWidth: view==="calendar" ? 1100 : 900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:18 }}>
        <h1 style={{ fontSize:26, fontWeight:800, margin:0 }}>My requests</h1>
        <div role="group" aria-label="View" style={{ display:"inline-flex", border:"2px solid var(--ink)", borderRadius:10, overflow:"hidden", background:"var(--card)" }}>
          {[["list", "☰  List"], ["calendar", "📅  Calendar"]].map(([v, text]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              style={{ padding:"9px 16px", fontSize:14.5, fontWeight:700, color:"var(--ink)", background: view === v ? "var(--blue)" : "var(--card)", borderRadius:0, boxShadow:"none", border:"none" }}>{text}</button>
          ))}
        </div>
      </div>

      <div className="filter-row" style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by room"
          style={{ flex:"1 1 200px", padding:"9px 12px", fontSize:14.5, border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", outline:"none" }} />
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{ padding:"9px 12px", fontSize:14.5,
          border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }}>
          {["All","pending","waitlisted","approved","denied","cancelled"].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={building} onChange={e=>setBuilding(e.target.value)} style={{ padding:"9px 12px", fontSize:14.5,
          border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)" }}>
          {buildings.map(b=><option key={b}>{b}</option>)}
        </select>
      </div>

      {view==="calendar" ? (
        filtered.length===0 ? (
          <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
            borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No requests match those filters.</div>
        ) : (<>
          <WeekCalendar weekStart={weekStart} onWeekChange={setWeekStart} events={events} maxHeight={620} />
          <CalendarLegend kinds={shownKinds} />
          {events.length===0 && <div style={{ marginTop:12, fontSize:14, color:"var(--ink-faint)" }}>None of these requests has a date and time to show.</div>}
          {undated>0 && events.length>0 && <div style={{ marginTop:12, fontSize:14, color:"var(--ink-faint)" }}>{undated} request{undated===1 ? "" : "s"} can't be shown here. See the list view.</div>}
        </>)
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--ink-faint)", background:"var(--card)",
          borderRadius:14, border:"2px dashed var(--ink-faint)" }}>No requests match those filters.</div>
      ) : (
        <div style={{ display:"grid", gap:12 }}>
          {filtered.map(req => (
            <div key={req.id} style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14,
              padding:16, boxShadow:"var(--shadow)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{req.event || req.room.name}</div>
                  <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{req.event ? `${req.room.name} · ` : ""}{showOrg ? `${req.org} · ` : ""}{req.room.building} · {req.date} · {req.time}</div>
                  {req.status==="denied" && <div style={{ fontSize:14, color:"var(--red)", marginTop:4 }}>Reason: {req.reason}</div>}
                </div>
                <Pill status={req.status} />
              </div>
              {req.status==="waitlisted" && (
                <div style={{ marginTop:12, background:"var(--blue-wash)", borderRadius:10, padding:"11px 14px", fontSize:14, color:"var(--ink-soft)", lineHeight:1.5 }}>
                  <b>Your spot: #{req.position || "–"}</b> in line for this time. {req.position > 1 ? `${req.position - 1} club${req.position === 2 ? "" : "s"} ahead of you.` : "You're next in line."}
                  {" "}You can't book this room unless the current group cancels. If they do, your request moves back to pending review and you'll get a notification.
                </div>
              )}
              {req.status!=="denied" && req.status!=="cancelled" && onCancel && (
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {asking===req.id ? (<>
                    <span style={{ fontSize:14, fontWeight:600 }}>{req.status==="waitlisted" ? "Leave the waitlist?" : "Cancel this request?"}</span>
                    <button disabled={busy===req.id} onClick={()=>cancel(req.id)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--red)", color:"#fff", cursor:"pointer" }}>{busy===req.id ? "Cancelling…" : "Yes, cancel it"}</button>
                    <button disabled={busy===req.id} onClick={()=>setAsking(null)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", color:"var(--ink)", cursor:"pointer" }}>Keep it</button>
                  </>) : (
                    <button onClick={()=>setAsking(req.id)} style={{ padding:"7px 14px", fontSize:14, fontWeight:700,
                      border:"2px solid var(--ink)", borderRadius:8, background:"var(--card)", color:"var(--ink)", cursor:"pointer" }}>{req.status==="waitlisted" ? "Leave waitlist" : "Cancel request"}</button>
                  )}
                </div>
              )}
              {req.status==="approved" && (
                <div style={{ marginTop:12, background:"var(--green-wash)", borderRadius:10, padding:"11px 14px",
                  fontSize:14, color:"var(--ink-soft)" }}>
                  Approved — <a href={SB_ENGAGED_URL} target="_blank" rel="noreferrer" style={{ color:"var(--link)", fontWeight:600 }}>
                    complete your SB Engaged event form</a> within <b>48 hours</b> to confirm this booking.
                  <div style={{ marginTop:4, color:"var(--ink-faint)", fontSize:13.5 }}>
                    Email confirmation sent to your e-board ({clubs.find(c=>c.name===req.org)?.count || 1} {(clubs.find(c=>c.name===req.org)?.count || 1) === 1 ? "person" : "people"}).
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {asking && (() => { const r = requests.find(x => x.id===asking); return r && (
        <ConfirmModal title="Cancel this request?" confirmLabel="Yes, cancel request" cancelLabel="Keep it" danger busy={busy===asking}
          onConfirm={()=>cancel(asking)} onCancel={()=>setAsking(null)}>
          <div style={{ marginBottom:10 }}>
            {r.status==="approved" ? "This booking is already approved. Cancelling it frees the room for other clubs." : "Your request will be withdrawn."}
          </div>
          <div style={{ border:"2px solid var(--ink)", borderRadius:10, padding:"12px 14px", background:"var(--paper)", color:"var(--ink)" }}>
            <div style={{ fontWeight:700, fontSize:16 }}>{r.room.name}</div>
            <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{r.date} · {r.time}</div>
          </div>
        </ConfirmModal>
      ); })()}
    </main>
  );
}
