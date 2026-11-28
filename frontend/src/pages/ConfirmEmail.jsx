import { useEffect, useState } from 'react';
import { LIVE, confirmAccountEmail } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

// The page the "confirm your email" link opens, for a general account adding an email
// for password resets. Works whether or not the person is logged in on this device.
export default function ConfirmEmail({ token, signedIn, onConfirmed, onDone }) {
  const [state,setState]=useState(token ? "working" : "bad");
  const [email,setEmail]=useState(""); const [msg,setMsg]=useState("");
  useEffect(()=>{
    if (!token) return;
    let off=false;
    (LIVE ? confirmAccountEmail(token) : Promise.resolve({ email:"" }))
      .then(r=>{ if (off) return; setEmail(r?.email || ""); onConfirmed?.(r?.email || ""); setState("ok"); })
      .catch(e=>{ if (!off) { setMsg(e.message); setState("bad"); } });
    return ()=>{ off=true; };
  },[token]); // eslint-disable-line

  return (
    <AuthShell title={state==="ok" ? "Email added" : state==="bad" ? "Link not valid" : "Confirming your email…"}
      subtitle={state==="ok"
        ? `${email ? email + " is" : "Your email is"} now on your account. If you ever forget your password, use "Forgot password?" on the log in page.`
        : state==="bad" ? (msg || "This link is invalid or has expired. Add your email again from your profile.") : "One moment."}
      footer={null}>
      {state!=="working" && (
        <button onClick={onDone} style={{ width:"100%", marginTop:18, padding:"14px", borderRadius:10, fontSize:16, fontWeight:700, color:"var(--ink)", background:"var(--blue)" }}>
          {signedIn ? "Back to my profile" : "Go to log in"}</button>
      )}
    </AuthShell>
  );
}
