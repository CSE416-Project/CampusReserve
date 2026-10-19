import { useState } from 'react';
import AuthShell, { authInput, authLabel } from '../components/AuthShell.jsx';

export default function Login({ onLogin, onSignup }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); 
  return (
    <AuthShell title="Welcome back" subtitle="Log in with your SBU email to book and manage spaces."
      footer={<>New to CampusReserve? <button onClick={onSignup} style={{ color:"var(--blue)", fontWeight:700, fontSize:15 }}>Create an account</button></>}>
      <form onSubmit={e=>{ e.preventDefault(); onLogin("leader"); }}>
        <label style={authLabel}>SBU email
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="netid@stonybrook.edu" style={authInput} />
        </label>
        <label style={authLabel}>Password
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" style={authInput} />
        </label>
        <button type="submit" style={{ width:"100%", marginTop:22, padding:"14px", borderRadius:11, fontSize:16, fontWeight:700,
          color:"#fff", background:"var(--blue)" }}>Log in</button>
      </form>
    </AuthShell>
  );
}
