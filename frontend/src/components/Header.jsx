const NAV = {
  leader: [["requests","My requests"],["find","Find a space"],["forum","Forum"],["messages","Messages"],["clubs","Clubs"]],
  admin: [["approvals","Approvals"],["verifications","Verifications"],["rooms","Rooms"],["forum","Forum"],["messages","Messages"],["clubs","Clubs"]],
  venue: [["rooms","Rooms"],["messages","Messages"],["clubs","Clubs"]],
};

export default function Header({ role, page, setPage, unread = 0, verifCount = 0, name = "", onLogout, onProfile }) {
  const nav = NAV[role];
  return (
    <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px",
      height:64, background:"var(--card)", borderBottom:"3px solid var(--ink)", position:"sticky", top:0, zIndex:20, flexWrap:"wrap", gap:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:28, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontFamily:"var(--display)", fontSize:22, letterSpacing:".01em" }}>CampusReserve</span>
        </div>
        <nav style={{ display:"flex", gap:4 }}>
          {nav.map(([id,label]) => (
            <button key={id} onClick={() => setPage(id)} style={{
              fontSize:15, fontWeight:500, padding:"8px 13px", borderRadius:8,
              color: page===id ? "var(--ink)" : "var(--ink-faint)",
              background: page===id ? "var(--line-soft)" : "transparent" }}>
              {label}
              {id==="verifications" && verifCount>0 && (
                <span aria-label={`${verifCount} verification requests`} style={{ marginLeft:7, minWidth:20, height:20, padding:"0 6px", borderRadius:999,
                  background:"var(--red-wash)", color:"var(--red)", fontSize:12, fontWeight:700, display:"inline-grid", placeItems:"center", verticalAlign:"middle" }}>
                  {verifCount>9 ? "9+" : verifCount}
                </span>
              )}
              {id==="messages" && unread>0 && (
                <span aria-label={`${unread} unread messages`} style={{ marginLeft:7, minWidth:20, height:20, padding:"0 6px", borderRadius:999,
                  background:"var(--red-wash)", color:"var(--red)", fontSize:12, fontWeight:700, display:"inline-grid", placeItems:"center", verticalAlign:"middle" }}>
                  {unread>9 ? "9+" : unread}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={onProfile} title="My profile" aria-label="My profile" style={{ width:36, height:36, borderRadius:999, background:"var(--blue-wash)", color:"var(--link)",
          display:"grid", placeItems:"center", fontWeight:700, fontSize:14, border: page==="profile" ? "2px solid var(--blue)" : "2px solid transparent" }}>
          {(name.trim()[0] || "?").toUpperCase()}
        </button>
        <button onClick={onLogout} style={{ fontSize:14, fontWeight:600, color:"var(--ink-soft)", padding:"7px 12px",
          borderRadius:8, border:"2px solid var(--ink)" }}>Log out</button>
      </div>
    </header>
  );
}
