import { useEffect, useState } from 'react';
import { LIVE, verifyEmail } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

// The page the signup email's link opens: confirms the address, then sends the person to log in.
export default function VerifyEmail({ token, onDone }) {
  const [state,setState]=useState(token ? "working" : "bad"); const [msg,setMsg]=useState("");
  useEffect(()=>{
    if (!token) return;
    let off=false;
    (LIVE ? verifyEmail(token) : Promise.resolve())
      .then(()=>{ if(!off) setState("ok"); })
      .catch(e=>{ if(!off){ setMsg(e.message); setState("bad"); } });
    return ()=>{ off=true; };
  },[token]);
  return (
    <AuthShell title={state==="ok" ? "Email confirmed" : state==="bad" ? "Link not valid" : "Confirming your email…"}
      subtitle={state==="ok" ? "Your account is ready. Log in to start booking spaces."
        : state==="bad" ? (msg || "This confirmation link is invalid or has expired. Log in to get a new one.") : "One moment."}
      footer={null}>
      {state!=="working" && (
        <button onClick={onDone} style={{ width:"100%", marginTop:18, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700, color:"var(--ink)", background:"var(--blue)" }}>
          {state==="ok" ? "Log in" : "Go to log in"}</button>
      )}
    </AuthShell>
  );
}
