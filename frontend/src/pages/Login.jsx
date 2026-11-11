import { useState } from 'react';
import { LIVE, login, resendVerification, ROLE_FROM_SERVER, USERNAME_RE } from '../api.js';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login({ onLogin, onSignup, onForgot }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [needsVerify,setNeedsVerify]=useState(false); const [resent,setResent]=useState(false);
  const [field,setField]=useState(null); // which input the error is about, for aria-invalid
  const fail = (msg, which=null) => { setError(msg); setField(which); setNeedsVerify(false); setResent(false); };
  return (
    <AuthShell title="Welcome back" subtitle="Log in with your SBU email, or your username if you have a general account."
      footer={<>New to CampusReserve? <button onClick={onSignup} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Create an account</button></>}>
      <form noValidate aria-describedby={error ? "login-error" : undefined} onSubmit={async e=>{ e.preventDefault();
        const who = email.trim();
        if (who.includes("@") ? !/^\S+@\S+\.\S+$/.test(who) : !USERNAME_RE.test(who))
          return fail(who.includes("@") ? "Enter a valid email address." : "Enter your SBU email or username.", "email");
        if (!password) return fail("Enter your password.", "password");
        if (LIVE) {
          setBusy(true);
          try { const u = await login(email, password); onLogin(ROLE_FROM_SERVER[u.role] || "leader", u); }
          catch (err) { fail(err.message); setNeedsVerify(err.code==='email_not_verified'); setBusy(false); }
          return;
        }
        onLogin(!who.includes("@") ? "general" : /admin/i.test(who) ? "admin" : /venue|host/i.test(who) ? "venue" : "leader"); }}>
        <label style={authLabel}>SBU email or username
          <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email}
            aria-invalid={field==="email" || undefined} aria-describedby={field==="email" ? "login-error" : undefined}
            onChange={e=>{ setEmail(e.target.value); fail(""); }} placeholder="firstname.lastname@stonybrook.edu or username" style={authInput} />
        </label>
        <label style={authLabel}>Password
          <PasswordInput autoComplete="current-password" required value={password}
            aria-invalid={field==="password" || undefined} aria-describedby={field==="password" ? "login-error" : undefined}
            onChange={e=>{ setPassword(e.target.value); fail(""); }} placeholder="Enter your password" style={authInput} />
        </label>
        <div style={{ textAlign:"right", marginTop:8 }}>
          <button type="button" onClick={()=>onForgot(email.includes("@") ? email : "")} style={{ color:"var(--link)", fontWeight:700, fontSize:14.5 }}>Forgot password?</button>
        </div>
        {error && <div id="login-error" role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:10 }}>{error}
          {needsVerify && <div style={{ marginTop:8 }}>{resent
            ? <span style={{ color:"var(--green)" }}>✓ Sent. Check your inbox (and spam).</span>
            : <button type="button" onClick={async()=>{ try { await resendVerification(email); } catch { /* same message either way */ } setResent(true); }}
                style={{ color:"var(--link)", fontWeight:700, textDecoration:"underline" }}>Email me the link again</button>}</div>}
        </div>}
        <button type="submit" disabled={busy} aria-busy={busy || undefined} style={{ width:"100%", marginTop:18, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
          color:"var(--ink)", background:"var(--blue)" }}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </AuthShell>
  );
}
