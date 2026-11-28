import { useEffect, useRef, useState } from 'react';
import Pill from './Pill.jsx';
import RoomPhoto from './RoomPhoto.jsx';
import useDialog from '../a11y/useDialog.js';
import { useIsCompact } from '../useMedia.js';
import { LIVE, roomDetails } from '../api.js';

// "08:00:00" / "8.5" / 8.5 -> "8:00 AM" ; anything else is shown as it came.
function fmtClock(v) {
  if (v === null || v === undefined || v === "") return "";
  let h, m;
  const t = /^(\d{1,2}):(\d{2})/.exec(String(v));
  if (t) { h = +t[1]; m = +t[2]; }
  else if (!Number.isNaN(Number(v))) { h = Math.floor(Number(v)); m = Math.round((Number(v) - h) * 60); }
  else return String(v);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 || h === 24 ? "AM" : "PM"}`;
}
// Consecutive days with the same hours become one line: "Mon–Fri 8 AM–10 PM".
function hoursLines(hours) {
  const rows = (hours || []).filter(h => h.day).map(h => ({ day: h.day, text: h.open || h.close ? `${fmtClock(h.open)}–${fmtClock(h.close)}` : "Closed" }));
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.text === r.text) last.days.push(r.day); else out.push({ text: r.text, days: [r.day] });
  }
  return out.map(o => `${o.days.length > 1 ? `${o.days[0]}–${o.days[o.days.length - 1]}` : o.days[0]}  ${o.text}`);
}
const sameText = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cell = { padding:"10px 12px", borderTop:"1px solid var(--line)", fontSize:15, verticalAlign:"top", overflowWrap:"anywhere" };
const label = { ...cell, fontSize:14, fontWeight:700, color:"var(--ink-soft)", width:150, background:"var(--paper)" };
const diff = { background:"var(--blue-wash)" };   // a row where the two rooms differ

// Two rooms side by side: photo, size, features, hours, rules and how busy they are.
export default function RoomCompare({ rooms, tabs, onClose, onBook }) {
  const panel = useRef(null);
  const compact = useIsCompact();
  useDialog(panel, { open: true, onClose });
  const [det, setDet] = useState({});   // id -> { hours, instructions, comments } from the server, or null when it couldn't load
  useEffect(() => {
    if (!LIVE) return;
    let off = false;
    rooms.forEach(r => { if (!r.live) return;
      roomDetails(r.id).then(d => { if (!off) setDet(x => ({ ...x, [r.id]: d })); }).catch(() => { if (!off) setDet(x => ({ ...x, [r.id]: null })); }); });
    return () => { off = true; };
  }, [rooms.map(r => r.id).join("|")]);   // eslint-disable-line react-hooks/exhaustive-deps

  const loading = r => LIVE && r.live && det[r.id] === undefined;
  const hours = r => (det[r.id] ? hoursLines(det[r.id].hours) : []);
  const rules = r => [det[r.id]?.instructions ?? r.instructions, det[r.id]?.comments].filter(Boolean).join("\n\n");
  const varies = f => new Set(rooms.map(r => JSON.stringify(f(r)))).size > 1;   // do the rooms differ on this row?
  const sets = rooms.map(r => new Set(r.features || []));
  const all = [...new Set(sets.flatMap(x => [...x]))];
  const shared = all.filter(f => sets.every(x => x.has(f)));
  const only = all.filter(f => !shared.includes(f)).sort((x, y) => sets.filter(z => z.has(y)).length - sets.filter(z => z.has(x)).length || x.localeCompare(y));
  const maxCap = Math.max(...rooms.map(r => r.cap));

  const rows = [
    ["Photo", r => <div style={{ height:150 }}><RoomPhoto room={r} /></div>, false],
    ["Availability", r => <Pill status={r.status} small />, varies(r => r.status)],
    ["Holds", r => <b style={{ fontSize:18, color: r.cap === maxCap && varies(x => x.cap) ? "var(--green, #0a7f4f)" : "inherit" }}>{r.cap}</b>, varies(r => r.cap)],
    ["Building", r => r.building, varies(r => r.building)],
    ["Type", r => r.type, varies(r => r.type)],
    ["Open hours", r => loading(r) ? <span style={{ color:"var(--ink-faint)" }}>Loading…</span>
        : hours(r).length ? hours(r).map((l, i) => <div key={i}>{l}</div>) : <span style={{ color:"var(--ink-faint)" }}>Not listed</span>, varies(hours)],
    ["Booking opens", r => r.opensDaysAhead != null ? `${r.opensDaysAhead} days ahead` : "Anytime", varies(r => r.opensDaysAhead)],
    ["Room rules", r => loading(r) ? <span style={{ color:"var(--ink-faint)" }}>Loading…</span>
        : rules(r) ? <div style={{ whiteSpace:"pre-line", maxHeight:150, overflowY:"auto", fontSize:14 }}>{rules(r)}</div> : <span style={{ color:"var(--ink-faint)" }}>None listed</span>, varies(rules)],
    ["Busy right now", r => `${r.pending || 0} pending request${r.pending === 1 ? "" : "s"} · ${r.waitlistCount || 0} on the waitlist`, varies(r => [r.pending || 0, r.waitlistCount || 0])],
  ];
  const bookBtn = (r, i) => (
    <button onClick={() => onBook(i)} disabled={r.closed}
      style={{ width:"100%", padding:"11px", fontSize:15.5, fontWeight:700, color:"var(--ink)", background: r.closed ? "var(--line-soft)" : "var(--blue)", borderRadius:10 }}>
      {r.closed ? "Not open to clubs" : "Book this room"}</button>
  );
  const chip = (f, on) => <span key={f} style={{ display:"inline-block", margin:"2px 4px 2px 0", padding:"3px 9px", borderRadius:999, fontSize:13.5, fontWeight:600,
    border:"2px solid var(--ink)", background: on ? "var(--blue-wash)" : "var(--card)", opacity: on ? 1 : .45, textDecoration: on ? "none" : "line-through" }}>{f}</span>;
  const labelW = compact ? 104 : 150, colW = compact ? 150 : 200;

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position:"fixed", inset:0, background:"rgba(27,42,74,.28)", zIndex:40 }} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`Compare ${rooms.map(r => r.name).join(", ")}`} tabIndex={-1} className="booking-panel"
        style={compact ? { position:"fixed", inset:0, background:"var(--card)", zIndex:50, display:"flex", flexDirection:"column" }
          : { position:"fixed", top:"3vh", bottom:"3vh", left:0, right:0, margin:"0 auto", width:"min(1180px, 96vw)", background:"var(--card)", zIndex:50,
              border:"2px solid var(--ink)", borderRadius:16, boxShadow:"var(--shadow-lift)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ position:"relative" }}>
          {tabs}
          <button onClick={onClose} aria-label="Close" style={{ position:"absolute", top:12, right:18, width:30, height:30, borderRadius:8, background:"var(--line-soft)" }}>×</button>
        </div>
        <div style={{ overflow:"auto", padding:"14px 22px 22px", flex:1 }}>
          <div style={{ fontSize:13.5, color:"var(--ink-faint)", margin:"0 0 10px" }}>Rows that differ are shaded.</div>
          <div style={{ overflowX:"auto" }}><table style={{ width:"100%", minWidth: labelW + rooms.length * colW, borderCollapse:"collapse", tableLayout:"fixed", border:"2px solid var(--ink)", borderRadius:12 }}>
            <thead><tr>
              <th style={{ ...label, width: labelW }} />
              {rooms.map(r => <th key={r.id} scope="col" style={{ ...cell, borderTop:"none", textAlign:"left", fontSize:17, fontWeight:800 }}>{r.name}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(([name, render, differs]) => (
                <tr key={name} style={differs ? diff : undefined}>
                  <th scope="row" style={{ ...label, width: labelW, textAlign:"left", ...(differs ? diff : {}) }}>{name}</th>
                  {rooms.map(r => <td key={r.id} style={cell}>{render(r)}</td>)}
                </tr>
              ))}
              <tr style={only.length ? diff : undefined}>
                <th scope="row" style={{ ...label, width: labelW, textAlign:"left", ...(only.length ? diff : {}) }}>What's in it</th>
                {rooms.map((r, i) => (
                  <td key={r.id} style={cell}>
                    {all.length === 0 && <span style={{ color:"var(--ink-faint)" }}>No features listed</span>}
                    {shared.map(f => chip(f, true))}
                    {only.map(f => chip(f, sets[i].has(f)))}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" style={{ ...label, textAlign:"left" }} />
                {rooms.map((r, i) => <td key={r.id} style={cell}>{bookBtn(r, i)}</td>)}
              </tr>
            </tbody>
          </table></div>
          <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:8 }}>Faded, crossed-out features are ones that room doesn't have.</div>
        </div>
      </div>
    </>
  );
}
