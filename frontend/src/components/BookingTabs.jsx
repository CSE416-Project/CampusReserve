// The tab row at the top of the booking window: one tab for each room, plus a Compare details tab once there are two or more.
// active: a number (that room's tab) or "compare" (the rooms side by side).
export default function BookingTabs({ rooms, active, onTab, onAdd, onRemove, max = 4 }) {
  const many = rooms.length > 1;
  return (
    <div role="tablist" aria-label="Rooms you are comparing" className="booking-tabs"
      style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", padding:"12px 64px 0 22px" }}>
      {rooms.map((r, i) => {
        const on = active === i;
        return (
          <div key={r.id} role="presentation" style={{ display:"flex", alignItems:"center", minWidth:0, flex:"0 1 auto",
            border:"2px solid var(--ink)", borderRadius:10, background: on ? "var(--blue)" : "var(--card)" }}>
            <button role="tab" id={`booking-tab-${i}`} aria-selected={on} onClick={() => onTab(i)} title={r.name}
              style={{ padding:"6px 10px", fontSize:14, fontWeight:700, color:"var(--ink)", background:"transparent", border:"none", boxShadow:"none",
                minWidth:0, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name.replace(/^.* - /, "")}</button>
            {many && <button onClick={() => onRemove(i)} aria-label={`Remove ${r.name}`}
              style={{ padding:"4px 8px", fontSize:16, color:"var(--ink)", background:"transparent", border:"none", boxShadow:"none" }}>×</button>}
          </div>
        );
      })}
      {many && (
        <button role="tab" id="booking-tab-compare" aria-selected={active === "compare"} onClick={() => onTab("compare")}
          style={{ padding:"6px 12px", fontSize:14, fontWeight:700, color:"var(--ink)", border:"2px solid var(--ink)", borderRadius:10, boxShadow:"none",
            background: active === "compare" ? "var(--blue)" : "var(--card)" }}>Compare details</button>
      )}
      {rooms.length < max && (
        <button onClick={onAdd} style={{ padding:"6px 12px", fontSize:14, fontWeight:700, color:"var(--ink)", background:"var(--card)",
          border:"2px dashed var(--ink)", borderRadius:10, boxShadow:"none" }}>{many ? "+ Add a room" : "⇄ Compare with another room"}</button>
      )}
    </div>
  );
}
