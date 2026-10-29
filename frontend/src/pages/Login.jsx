import { useState } from 'react';
import { LIVE, login, ROLE_FROM_SERVER } from '../api.js';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login({ onLogin, onSignup }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [field,setField]=useState(null); // which input the error is about, for aria-invalid
  const fail = (msg, which=null) => { setError(msg); setField(which); };
  return (
    <AuthShell title="Welcome back" subtitle="Log in with your SBU email to book and manage spaces."
      footer={<>New to CampusReserve? <button onClick={onSignup} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Create an account</button></>}>
      <form noValidate aria-describedby={error ? "login-error" : undefined} onSubmit={async e=>{ e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail("Enter a valid email address.", "email");
        if (!password) return fail("Enter your password.", "password");
        if (LIVE) {
          setBusy(true);
          try { const u = await login(email, password); onLogin(ROLE_FROM_SERVER[u.role] || "leader", u); }
          catch (err) { fail(err.message); setBusy(false); }
          return;
        }
        onLogin(/admin/i.test(email) ? "admin" : /venue|host/i.test(email) ? "venue" : "leader"); }}>
        <label style={authLabel}>SBU email
          <input type="email" autoComplete="email" required value={email}
            aria-invalid={field==="email" || undefined} aria-describedby={field==="email" ? "login-error" : undefined}
            onChange={e=>{ setEmail(e.target.value); fail(""); }} placeholder="firstname.lastname@stonybrook.edu" style={authInput} />
        </label>
        <label style={authLabel}>Password
          <PasswordInput autoComplete="current-password" required value={password}
            aria-invalid={field==="password" || undefined} aria-describedby={field==="password" ? "login-error" : undefined}
            onChange={e=>{ setPassword(e.target.value); fail(""); }} placeholder="Enter your password" style={authInput} />
        </label>
        {error && <div id="login-error" role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>{error}</div>}
        <button type="submit" disabled={busy} aria-busy={busy || undefined} style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
          color:"var(--ink)", background:"var(--blue)" }}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </AuthShell>
  );
}