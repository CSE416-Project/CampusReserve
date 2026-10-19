import { useState } from 'react';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';

export default function CreateAccount({ onCreate, onLogin }) {
  const [form,setForm]=useState({ name:"", email:"", org:"", password:"", confirm:"" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <AuthShell title="Create your account" subtitle="Use your SBU email. It only takes a minute."
      footer={<>Already have an account? <button onClick={onLogin} style={{ color:"var(--blue)", fontWeight:700, fontSize:15 }}>Log in</button></>}>
      <form onSubmit={e=>{ e.preventDefault(); onCreate("leader"); }}>
        <label style={authLabel}>Full name
          <input value={form.name} onChange={set("name")} placeholder="Jane Doe" style={authInput} />
        </label>
        <label style={authLabel}>SBU email
          <input type="email" value={form.email} onChange={set("email")} placeholder="netid@stonybrook.edu" style={authInput} />
        </label>
        {(
          <>
            <label style={authLabel}>Club / organization
              <input value={form.org} onChange={set("org")} placeholder="e.g. Robotics Club" style={authInput} />
            </label>
            <div style={{ fontSize:13, color:"var(--ink-faint)", marginTop:6 }}>
              E-board membership is verified before you can request bookings.
            </div>
          </>
        )}
        <label style={authLabel}>Password
          <input type="password" value={form.password} onChange={set("password")} placeholder="Create a password" style={authInput} />
        </label>
        <label style={authLabel}>Confirm password
          <input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Re-enter your password" style={authInput} />
        </label>
        <button type="submit" style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:11, fontSize:16, fontWeight:700,
          color:"#fff", background:"var(--blue)" }}>Create account</button>
      </form>
    </AuthShell>
  );
}
