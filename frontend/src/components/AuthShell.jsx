export const authInput = {
  width:"100%", padding:"12px 14px", fontSize:15.5, border:"2px solid var(--ink)", borderRadius:10,
  background:"var(--paper)", outline:"none", marginTop:6,
};
export const authLabel = { fontSize:14, fontWeight:600, color:"var(--ink-soft)", display:"block", marginTop:16 };

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div style={{ minHeight:"100dvh", display:"grid", placeItems:"center", padding:"32px 16px", background:"var(--paper)" }}>
      <div style={{ width:"100%", maxWidth:440 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:26 }}>
          <span style={{ fontFamily:"var(--display)", fontSize:28 }}>CampusReserve</span>
        </div>
        <div className="auth-card" style={{ background:"var(--card)", border:"2px solid var(--ink)", borderRadius:18, padding:"30px 30px 26px", boxShadow:"var(--shadow-lift)" }}>
          <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>{title}</h1>
          <p style={{ fontSize:15, color:"var(--ink-soft)" }}>{subtitle}</p>
          {children}
        </div>
        <div style={{ textAlign:"center", marginTop:18, fontSize:15, color:"var(--ink-soft)" }}>{footer}</div>
      </div>
    </div>
  );
}
