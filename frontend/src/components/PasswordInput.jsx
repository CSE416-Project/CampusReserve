import { useState } from 'react';

// A password box with a Show/Hide button so people can check what they typed.
export default function PasswordInput({ style, ...props }) {
  const [show, setShow] = useState(false);
  const { marginTop, ...inputStyle } = style || {};
  return (
    <div style={{ position:"relative", marginTop }}>
      <input {...props} type={show ? "text" : "password"} style={{ ...inputStyle, paddingRight:68 }} />
      <button type="button" onClick={()=>setShow(s=>!s)} aria-label={show ? "Hide password" : "Show password"}
        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
          fontSize:13.5, fontWeight:700, color:"var(--link)", background:"none", border:"none", cursor:"pointer", padding:"4px 6px" }}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
