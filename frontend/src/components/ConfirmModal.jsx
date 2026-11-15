import { useEffect } from 'react';

// A centered "are you sure?" box. Click the dark area, press Esc or choose the
// cancel button to close it; nothing happens until the confirm button is used.
export default function ConfirmModal({ title, children, confirmLabel = "Confirm", cancelLabel = "Back", danger = false, busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div onClick={() => !busy && onCancel()} style={{ position:"fixed", inset:0, background:"rgba(27,42,74,.45)", zIndex:80,
      display:"grid", placeItems:"center", padding:20 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width:"100%", maxWidth:440, maxHeight:"90vh", overflowY:"auto", background:"var(--card)", border:"2px solid var(--ink)",
          borderRadius:16, padding:"24px 24px 20px", boxShadow:"var(--shadow-lift)" }}>
        <div style={{ fontSize:22, fontWeight:800, marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:15, color:"var(--ink-soft)", marginBottom:18 }}>{children}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
          <button disabled={busy} onClick={onCancel} style={{ padding:"11px 18px", borderRadius:10, fontSize:15.5, fontWeight:700,
            border:"2px solid var(--ink)", background:"var(--card)", color:"var(--ink)", cursor:"pointer" }}>{cancelLabel}</button>
          <button disabled={busy} onClick={onConfirm} autoFocus style={{ padding:"11px 18px", borderRadius:10, fontSize:15.5, fontWeight:700,
            border:"2px solid var(--ink)", cursor:"pointer",
            background: danger ? "var(--red)" : "var(--blue)", color: danger ? "#fff" : "var(--ink)" }}>{busy ? "Please wait…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
