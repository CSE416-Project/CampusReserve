import { useState } from 'react';
import { CLUBS } from '../data/mock.js';
import Avatar from '../components/Avatar.jsx';

const ROLE_LABEL = { leader:"Club leader", admin:"Administrator", venue:"Venue host" };
const field = { width:"100%", padding:"11px 13px", fontSize:15, border:"2px solid var(--ink)", borderRadius:10,
  background:"var(--paper)", outline:"none", marginTop:6 };
const label = { fontSize:14, fontWeight:600, color:"var(--ink-soft)", display:"block", marginTop:16 };
const card = { background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:"24px 26px", boxShadow:"var(--shadow)", marginBottom:22 };
const primary = { padding:"11px 22px", borderRadius:10, fontSize:15, fontWeight:700, color:"var(--ink)", background:"var(--blue)" };

export default function Profile({ role, profile, onSave, onOpenClub }) {
  const [name,setName]=useState(profile.name); const [bio,setBio]=useState(profile.bio); const [saved,setSaved]=useState(false);
  const [cur,setCur]=useState(""); const [next,setNext]=useState(""); const [confirm,setConfirm]=useState(""); const [pwMsg,setPwMsg]=useState(null);

  // every club whose e-board lists this person's email
  const memberships = CLUBS.flatMap(c => c.eboard.filter(m => m.email === profile.email).map(m => ({ club:c.name, title:m.title })));

  const updatePassword = () => {
    if (!cur) return setPwMsg({ ok:false, text:"Enter your current password." });
    if (next.length < 8) return setPwMsg({ ok:false, text:"New password must be at least 8 characters." });
    if (next !== confirm) return setPwMsg({ ok:false, text:"The new passwords don't match." });
    setPwMsg({ ok:true, text:"✓ Password updated." }); setCur(""); setNext(""); setConfirm("");
  };

  return (
    <main style={{ maxWidth:700, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>My profile</h1>

      <div style={card}>
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:6 }}>
          <Avatar name={name || "?"} size={64} />
          <div>
            <div style={{ fontSize:20, fontWeight:800 }}>{name}</div>
            <div style={{ fontSize:14.5, color:"var(--ink-soft)" }}>{ROLE_LABEL[role]} · {profile.title}</div>
          </div>
        </div>
        <label style={label}>Full name
          <input value={name} onChange={e=>{ setName(e.target.value); setSaved(false); }} style={field} />
        </label>
        <label style={label}>SBU email
          <input value={profile.email} readOnly style={{ ...field, color:"var(--ink-faint)" }} />
        </label>
        <label style={label}>About me
          <textarea value={bio} onChange={e=>{ setBio(e.target.value); setSaved(false); }} rows={3} style={{ ...field, resize:"vertical" }} />
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20 }}>
          <button onClick={()=>{ onSave({ name, bio }); setSaved(true); }} style={primary}>Save changes</button>
          {saved && <span style={{ fontSize:14.5, color:"var(--green)", fontWeight:600 }}>✓ Saved</span>}
        </div>
      </div>

      {memberships.length > 0 && (
        <div style={card}>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>My organizations ({memberships.length})</div>
          <div style={{ fontSize:14.5, color:"var(--ink-soft)", marginBottom:14 }}>You can book spaces for any club you're an e-board member of.</div>
          <div style={{ display:"grid", gap:10 }}>
            {memberships.map(m => (
              <button key={m.club} onClick={()=>onOpenClub(m.club)} style={{ display:"flex", alignItems:"center", gap:12, textAlign:"left",
                border:"2px solid var(--ink)", borderRadius:10, padding:"12px 14px", background:"var(--paper)" }}>
                <Avatar name={m.club} size={40} />
                <span style={{ flex:1 }}>
                  <span style={{ display:"block", fontWeight:700, fontSize:15.5 }}>{m.club}</span>
                  <span style={{ display:"block", fontSize:13.5, color:"var(--ink-soft)" }}>{m.title}</span>
                </span>
                <span style={{ fontSize:14, fontWeight:600, color:"var(--link)" }}>View ›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize:18, fontWeight:700 }}>Change password</div>
        <label style={label}>Current password
          <input type="password" value={cur} onChange={e=>{ setCur(e.target.value); setPwMsg(null); }} style={field} />
        </label>
        <label style={label}>New password
          <input type="password" value={next} onChange={e=>{ setNext(e.target.value); setPwMsg(null); }} placeholder="At least 8 characters" style={field} />
        </label>
        <label style={label}>Confirm new password
          <input type="password" value={confirm} onChange={e=>{ setConfirm(e.target.value); setPwMsg(null); }} style={field} />
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20, flexWrap:"wrap" }}>
          <button onClick={updatePassword} style={primary}>Update password</button>
          {pwMsg && <span style={{ fontSize:14.5, fontWeight:600, color: pwMsg.ok ? "var(--green)" : "var(--red)" }}>{pwMsg.text}</span>}
        </div>
      </div>
    </main>
  );
}
