import { useMemo, useRef, useState } from 'react';
import Pill from './Pill.jsx';
import useDialog from '../a11y/useDialog.js';

// A small window on top of the booking window for choosing the room to compare with.
export default function ComparePicker({ rooms, open, onPick, onClose }) {   // open: the rooms already in the window
  const [q, setQ] = useState("");
  const panel = useRef(null);
  useDialog(panel, { open: true, onClose });
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hit = r => words.every(w => `${r.name} ${r.building || ""}`.toLowerCase().includes(w));
    const taken = new Set(open.map(r => String(r.id))), here = open[open.length - 1];
    return rooms.filter(r => !taken.has(String(r.id)) && hit(r))
      .sort((a, b) => (b.building === here.building) - (a.building === here.building) || a.name.localeCompare(b.name))
      .slice(0, 60);   // same building first
  }, [rooms, open, q]);
  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position:"fixed", inset:0, background:"rgba(27,42,74,.35)", zIndex:60 }} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Choose a room to compare" tabIndex={-1}
        style={{ position:"fixed", top:"10vh", left:0, right:0, margin:"0 auto", width:"min(520px, 94vw)", maxHeight:"78vh", zIndex:70,
          background:"var(--card)", border:"2px solid var(--ink)", borderRadius:16, boxShadow:"var(--shadow-lift)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"16px 18px 10px", borderBottom:"1px solid var(--line)" }}>
          <div style={{ fontSize:19, fontWeight:800 }}>Add a room to compare</div>
          <div style={{ fontSize:14, color:"var(--ink-faint)", margin:"2px 0 10px" }}>Pick a room. It opens in its own tab, next to {open.map(r => r.name.replace(/^.* - /, "")).join(", ")}.</div>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by room or building" aria-label="Search rooms"
            style={{ width:"100%", padding:"10px 12px", fontSize:15, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)", outline:"none" }} />
        </div>
        <div style={{ overflowY:"auto", padding:"8px 10px 12px" }}>
          {list.length === 0 && <div style={{ padding:"14px 8px", color:"var(--ink-faint)", fontSize:15 }}>No rooms match.</div>}
          {list.map(r => (
            <button key={r.id} onClick={() => onPick(r)}
              style={{ display:"flex", width:"100%", alignItems:"center", justifyContent:"space-between", gap:10, textAlign:"left", padding:"10px 12px", margin:"3px 0",
                border:"2px solid var(--line)", borderRadius:10, background:"var(--card)", color:"var(--ink)", boxShadow:"none" }}>
              <span style={{ minWidth:0 }}>
                <span style={{ display:"block", fontWeight:700, fontSize:15 }}>{r.name}</span>
                <span style={{ display:"block", fontSize:13.5, color:"var(--ink-faint)" }}>{r.building} · Holds {r.cap}</span>
              </span>
              <Pill status={r.status} small />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
