import { useEffect, useState } from 'react';
import { LIVE, getAccountEmail, setAccountEmail, removeAccountEmail } from '../api.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Profile card for a general account's optional email. It's only used for password
// resets, and only counts once the person opens the link we send to it.
export default function AccountEmail({ email: startEmail = "", onEmailChange, styles }) {
  const { card, label, field, primary } = styles;
  const [state,setState]=useState({ email: startEmail || null, pending: null });
  const [loaded,setLoaded]=useState(!LIVE);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null);   // { ok, text }

  const apply = r => {
    setState({ email: r.email || null, pending: r.pending_email || null });
    if ((r.email || "") !== (startEmail || "")) onEmailChange?.(r.email || "");
  };
  useEffect(() => {
    if (!LIVE) return;
    let off = false;
    getAccountEmail().then(r => { if (!off) { apply(r); setLoaded(true); } })
      .catch(e => { if (!off) { setMsg({ ok:false, text:e.message }); setLoaded(true); } });
    return () => { off = true; };
  }, []); // eslint-disable-line

  const send = async (address) => {
    const value = (address ?? draft).trim();
    if (!EMAIL_RE.test(value)) { setMsg({ ok:false, text:"Enter a valid email address." }); return; }
    setBusy(true); setMsg(null);
    try {
      if (LIVE) apply(await setAccountEmail(value));
      else setState(s => ({ ...s, pending: value }));
      setEditing(false); setDraft("");
      setMsg({ ok:true, text:`✓ We sent a link to ${value}. Open it to finish adding your email.` });
    } catch (e) { setMsg({ ok:false, text:e.message }); }
    setBusy(false);
  };
  const cancelPending = async () => {
    if (!state.email) return remove();
    setBusy(true); setMsg(null);
    try {
      // Setting it back to the confirmed address cancels the waiting link.
      if (LIVE) apply(await setAccountEmail(state.email));
      else setState(s => ({ ...s, pending:null }));
      setMsg({ ok:true, text:"✓ Cancelled." });
    } catch (e) { setMsg({ ok:false, text:e.message }); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true); setMsg(null);
    try {
      if (LIVE) apply(await removeAccountEmail());
      else { setState({ email:null, pending:null }); onEmailChange?.(""); }
      setMsg({ ok:true, text: state.pending && !state.email ? "✓ Cancelled." : "✓ Email removed." });
    } catch (e) { setMsg({ ok:false, text:e.message }); }
    setBusy(false);
  };

  const link = { color:"var(--link)", fontWeight:700, fontSize:14.5, textDecoration:"underline" };
  const showForm = editing || (!state.email && !state.pending);

  return (
    <div className="card-pad" style={card}>
      <div style={{ fontSize:18, fontWeight:700 }}>Email for password resets <span style={{ fontWeight:500, color:"var(--ink-faint)" }}>(optional)</span></div>
      <p style={{ marginTop:6, fontSize:14.5, color:"var(--ink-soft)", lineHeight:1.5 }}>
        Add an email so you can get a reset link if you forget your password. We won't use it for anything else.
        You can also log in with it once it's confirmed.</p>

      {!loaded ? <div role="status" style={{ marginTop:12, fontSize:14.5, color:"var(--ink-faint)" }}>Loading…</div> : (<>
        {state.email && (
          <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:15.5, fontWeight:600 }}>{state.email}</span>
            <span style={{ fontSize:13, fontWeight:700, padding:"3px 9px", borderRadius:999, background:"var(--green-wash)", color:"var(--green)" }}>Confirmed</span>
            {!editing && <>
              <button onClick={()=>{ setEditing(true); setMsg(null); }} style={link}>Change</button>
              <button onClick={remove} disabled={busy} style={link}>Remove</button>
            </>}
          </div>
        )}
        {state.pending && (
          <div role="status" style={{ marginTop:14, padding:"10px 13px", borderRadius:10, background:"var(--amber-wash)", fontSize:14.5, lineHeight:1.5 }}>
            Waiting for you to confirm <b>{state.pending}</b>. Check that inbox (and its spam folder) for our link.
            <div style={{ marginTop:6, display:"flex", gap:14, flexWrap:"wrap" }}>
              <button onClick={()=>send(state.pending)} disabled={busy} style={link}>Send the link again</button>
              <button onClick={cancelPending} disabled={busy} style={link}>Cancel</button>
            </div>
          </div>
        )}
        {showForm && (<>
          <label style={label}>{state.email ? "New email" : "Email"}
            <input type="email" autoComplete="email" value={draft} onChange={e=>{ setDraft(e.target.value); setMsg(null); }}
              onKeyDown={e=>{ if (e.key === "Enter") send(); }} placeholder="you@example.com" style={field} />
          </label>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:16, flexWrap:"wrap" }}>
            <button onClick={()=>send()} disabled={busy} style={primary}>{busy ? "Sending…" : "Send confirmation link"}</button>
            {editing && <button onClick={()=>{ setEditing(false); setDraft(""); setMsg(null); }} style={link}>Cancel</button>}
          </div>
        </>)}
      </>)}
      {msg && <div role={msg.ok ? "status" : "alert"} style={{ marginTop:10, fontSize:14.5, fontWeight:600, color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}
    </div>
  );
}
