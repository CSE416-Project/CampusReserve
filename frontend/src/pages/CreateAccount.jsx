import { useState } from 'react';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';

export default function CreateAccount({ onCreate, onLogin }) {
  const [error,setError]=useState("");
  const [form,setForm]=useState({ name:"", email:"", org:"", others:"", password:"", confirm:"" });
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setError(""); };
  return (
    <AuthShell title="Create your account" subtitle="Use your SBU email. It only takes a minute."
      footer={<>Already have an account? <button onClick={onLogin} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Log in</button></>}>
      <form noValidate onSubmit={e=>{ e.preventDefault();
        if (!form.name.trim()) return setError("Enter your full name.");
        if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Enter a valid email address.");
        if (!form.org.trim()) return setError("Enter your club or organization.");
        if (form.password.length < 8) return setError("Password must be at least 8 characters.");
        if (form.password !== form.confirm) return setError("The passwords don't match.");
        onCreate("leader"); }}>
        <label style={authLabel}>Full name
          <input value={form.name} onChange={set("name")} placeholder="Jane Doe" style={authInput} />
        </label>
        <label style={authLabel}>SBU email
          <input type="email" value={form.email} onChange={set("email")} placeholder="netid@stonybrook.edu" style={authInput} />
        </label>
        <label style={authLabel}>Club / organization
          <input value={form.org} onChange={set("org")} placeholder="e.g. Robotics Club" style={authInput} />
        </label>
        <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:6 }}>
          One account per club. E-board membership is verified before you can request bookings.
        </div>
        <label style={authLabel}>Other e-board emails (optional)
          <textarea value={form.others} onChange={set("others")} rows={2} placeholder="They get an email when a booking is approved. Separate with commas." style={{ ...authInput, resize:"vertical" }} />
        </label>
        <label style={authLabel}>Password
          <input type="password" value={form.password} onChange={set("password")} placeholder="Create a password" style={authInput} />
        </label>
        <label style={authLabel}>Confirm password
          <input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter your password" style={authInput} />
        </label>
        {error && <div role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>{error}</div>}
        <button type="submit" style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
          color:"var(--ink)", background:"var(--blue)" }}>Create account</button>
      </form>
    </AuthShell>
  );
}
