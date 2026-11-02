import { useState } from 'react';
import { LIVE, forgotPassword } from '../api.js';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';

// Type your email, get a link. It always says the same thing, so it can't be used to find out who has an account.
export default function ForgotPassword({ onBack, initialEmail = "" }) {
  const [email,setEmail]=useState(initialEmail); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [sent,setSent]=useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true); setError("");
    try { if (LIVE) await forgotPassword(email); setSent(true); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <AuthShell title={sent ? "Check your email" : "Forgot your password?"}
      subtitle={sent ? "" : "Enter your SBU email and we'll send you a link to choose a new one."}
      footer={<button onClick={onBack} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>← Back to log in</button>}>
      {sent ? (
        <div role="status" style={{ marginTop:4, fontSize:15.5, lineHeight:1.55, color:"var(--ink-soft)" }}>
          If there's an account for <b style={{ color:"var(--ink)" }}>{email.trim()}</b>, we just emailed it a link. Open the link to choose a new password. It works for 1 hour.
          {!LIVE && <div style={{ marginTop:10, fontSize:14, color:"var(--ink-faint)" }}>Demo mode: no email is sent here.</div>}
          <div style={{ marginTop:14, fontSize:14, color:"var(--ink-faint)" }}>Nothing arrived? Check your spam folder, or <button onClick={()=>setSent(false)} style={{ color:"var(--link)", fontWeight:700, fontSize:14 }}>try again</button>.</div>
        </div>
      ) : (
        <form noValidate onSubmit={submit}>
          <label style={authLabel}>SBU email
            <input type="email" autoComplete="email" value={email} onChange={e=>{ setEmail(e.target.value); setError(""); }}
              placeholder="firstname.lastname@stonybrook.edu" style={authInput} />
          </label>
          {error && <div role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
            color:"var(--ink)", background:"var(--blue)" }}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}
