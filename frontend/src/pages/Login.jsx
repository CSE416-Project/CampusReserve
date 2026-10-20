import { useState } from 'react';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';

export default function Login({ onLogin, onSignup }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState("");
  return (
    <AuthShell title="Welcome back" subtitle="Log in with your SBU email to book and manage spaces."
      footer={<>New to CampusReserve? <button onClick={onSignup} style={{ color:"var(--link)", fontWeight:700, fontSize:15 }}>Create an account</button></>}>
      <form noValidate onSubmit={e=>{ e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
        if (!password) return setError("Enter your password.");
        onLogin(/admin/i.test(email) ? "admin" : /venue|host/i.test(email) ? "venue" : "leader"); }}>
        <label style={authLabel}>SBU email
          <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); setError(""); }} placeholder="netid@stonybrook.edu" style={authInput} />
        </label>
        <label style={authLabel}>Password
          <input type="password" value={password} onChange={e=>{ setPassword(e.target.value); setError(""); }} placeholder="Enter your password" style={authInput} />
        </label>
        {error && <div role="alert" style={{ color:"var(--red)", fontSize:14.5, fontWeight:600, marginTop:14 }}>{error}</div>}
        <button type="submit" style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700,
          color:"var(--ink)", background:"var(--blue)" }}>Log in</button>
      </form>
    </AuthShell>
  );
}
