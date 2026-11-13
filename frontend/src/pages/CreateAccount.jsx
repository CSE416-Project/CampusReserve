import { useState } from 'react';
import { LIVE, register, registerGeneral, login, resendVerification, ROLE_FROM_SERVER, USERNAME_RE } from '../api.js';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const KINDS = [
  { id:"sbu", title:"SBU email account", text:"For club leaders and staff. Book rooms once an admin verifies your club." },
  { id:"general", title:"General account", text:"Just a username. Search rooms and see the campus map, but not book." },
];

export default function CreateAccount({ onCreate, onLogin }) {
  const [kind,setKind]=useState("sbu");
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [sentTo,setSentTo]=useState(null); const [resent,setResent]=useState(false);
  const [form,setForm]=useState({ name:"", email:"", username:"", password:"", confirm:"" });
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setError(""); };
  const general = kind === "general";

  if (sentTo) return (
    <AuthShell title="Check your email" subtitle="" footer={<button onClick={onLogin} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Go to log in</button>}>
      <div role="status" style={{ marginTop:4, fontSize:15.5, lineHeight:1.55, color:"var(--ink-soft)" }}>
        We sent a confirmation link to <b style={{ color:"var(--ink)" }}>{sentTo}</b>. Open it to finish creating your account, then log in. The link works for 24 hours.
        <div style={{ marginTop:14, fontSize:14, color:"var(--ink-faint)" }}>Nothing arrived? Check your spam folder, or{" "}
          {resent ? <span style={{ color:"var(--green)", fontWeight:600 }}>✓ sent again.</span>
            : <button onClick={async()=>{ try { await resendVerification(sentTo); } catch { /* same either way */ } setResent(true); }} style={{ color:"var(--link)", fontWeight:700, fontSize:14 }}>email it again</button>}
        </div>
      </div>
    </AuthShell>);

  const submit = async e => {
    e.preventDefault();
    if (general) {
      const username = form.username.trim();
      if (!USERNAME_RE.test(username)) return setError("Pick a username of 3 to 30 letters, numbers, dots, dashes or underscores.");
    } else {
      if (!form.name.trim()) return setError("Enter your full name.");
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    }
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("The passwords don't match.");
    if (!LIVE) return onCreate(general ? "general" : "leader");

    setBusy(true);
    try {
      if (general) {
        // No email to confirm, so log straight in.
        await registerGeneral(form.username, form.password);
        const u = await login(form.username, form.password);
        onCreate(ROLE_FROM_SERVER[u.role] || "general", u);
        return;
      }
      await register(form.email, form.name, form.password);
      setSentTo(form.email.trim());     // the server emailed a link; they log in after clicking it
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <AuthShell title="Create your account"
      subtitle={general ? "Pick a username and password. No email needed." : "Use your SBU email. It only takes a minute."}
      footer={<>Already have an account? <button onClick={onLogin} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Log in</button></>}>
      <fieldset style={{ border:"none", padding:0, margin:"18px 0 0" }}>
        <legend style={{ fontSize:14, fontWeight:600, color:"var(--ink-soft)", marginBottom:8 }}>Account type</legend>
        <div style={{ display:"grid", gap:8 }}>
          {KINDS.map(k => {
            const on = kind === k.id;
            return (
              <label key={k.id} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"11px 13px", borderRadius:10, cursor:"pointer",
                border:`2px solid ${on ? "var(--ink)" : "var(--line)"}`, background: on ? "var(--blue-wash)" : "var(--paper)" }}>
                <input type="radio" name="account-kind" value={k.id} checked={on}
                  onChange={()=>{ setKind(k.id); setError(""); }} style={{ marginTop:4, accentColor:"var(--ink)" }} />
                <span>
                  <span style={{ display:"block", fontSize:15, fontWeight:700, color:"var(--ink)" }}>{k.title}</span>
                  <span style={{ display:"block", fontSize:13.5, color:"var(--ink-soft)", lineHeight:1.4 }}>{k.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <form noValidate onSubmit={submit}>
        {general ? (
          <label style={authLabel}>Username
            <input value={form.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" spellCheck={false}
              placeholder="e.g. seawolf_fan" maxLength={30} style={authInput} />
            <span style={{ display:"block", marginTop:5, fontSize:13, fontWeight:500, color:"var(--ink-faint)" }}>
              3–30 letters, numbers, dots, dashes or underscores. You'll log in with this.</span>
          </label>
        ) : (<>
          <label style={authLabel}>Full name
            <input value={form.name} onChange={set("name")} placeholder="Jane Doe" style={authInput} />
          </label>
          <label style={authLabel}>SBU email
            <input type="email" value={form.email} onChange={set("email")} placeholder="firstname.lastname@stonybrook.edu" style={authInput} />
          </label>
        </>)}
        <label style={authLabel}>Password
          <PasswordInput value={form.password} onChange={set("password")} autoComplete="new-password" placeholder="Create a password" style={authInput} />
        </label>
        <label style={authLabel}>Confirm password
          <PasswordInput value={form.confirm} onChange={set("confirm")} autoComplete="new-password" placeholder="Re-enter your password" style={authInput} />
        </label>
        {general && <div style={{ marginTop:12, fontSize:13.5, color:"var(--ink-soft)", lineHeight:1.45 }}>
          There's no email on a general account, so we can't send a reset link if you forget your password.</div>}
        {error && <div role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
          color:"var(--ink)", background:"var(--blue)" }}>{busy ? "Creating…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}
