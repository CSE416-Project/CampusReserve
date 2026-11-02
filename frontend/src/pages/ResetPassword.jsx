import { useState } from 'react';
import { LIVE, resetPassword } from '../api.js';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

// The page the emailed link opens: choose a new password.
export default function ResetPassword({ token, onDone, onRequestNew }) {
  const [pw,setPw]=useState(""); const [confirm,setConfirm]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [done,setDone]=useState(false);
  const submit = async e => {
    e.preventDefault();
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== confirm) return setError("The passwords don't match.");
    setBusy(true); setError("");
    try { if (LIVE) await resetPassword(token, pw); setDone(true); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };
  if (!token) return (
    <AuthShell title="Link not valid" subtitle="This page needs the link from your email." footer={<button onClick={onDone} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Back to log in</button>}>
      <button onClick={onRequestNew} style={{ width:"100%", marginTop:18, padding:"13px", borderRadius:10, fontSize:16, fontWeight:700, color:"var(--ink)", background:"var(--blue)" }}>Get a new link</button>
    </AuthShell>);
  return (
    <AuthShell title={done ? "Password updated" : "Choose a new password"}
      subtitle={done ? "You can log in with your new password now." : "Pick something you haven't used before. At least 8 characters."}
      footer={!done && <button onClick={onDone} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Back to log in</button>}>
      {done ? (
        <button onClick={onDone} style={{ width:"100%", marginTop:18, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700, color:"var(--ink)", background:"var(--blue)" }}>Log in</button>
      ) : (
        <form noValidate onSubmit={submit}>
          <label style={authLabel}>New password
            <PasswordInput autoComplete="new-password" value={pw} onChange={e=>{ setPw(e.target.value); setError(""); }} placeholder="At least 8 characters" style={authInput} />
          </label>
          <label style={authLabel}>Confirm new password
            <PasswordInput autoComplete="new-password" value={confirm} onChange={e=>{ setConfirm(e.target.value); setError(""); }} placeholder="Re-enter your new password" style={authInput} />
          </label>
          {error && <div role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>
            {error} {/invalid or has expired/i.test(error) && <button type="button" onClick={onRequestNew} style={{ color:"var(--link)", fontWeight:700, textDecoration:"underline" }}>Get a new link</button>}</div>}
          <button type="submit" disabled={busy} style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
            color:"var(--ink)", background:"var(--blue)" }}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
