import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';

const ROLE_LABEL = { leader:"Club leader", admin:"Administrator", venue:"Venue host" };
const field = { width:"100%", padding:"11px 13px", fontSize:15, border:"1px solid var(--line)", borderRadius:10,
  background:"var(--paper)", outline:"none", marginTop:6 };
const label = { fontSize:14, fontWeight:600, color:"var(--ink-soft)", display:"block", marginTop:16 };

export default function Profile({ role, profile, onSave, onOpenClub }) {
  const [name,setName]=useState(profile.name); const [bio,setBio]=useState(profile.bio); const [saved,setSaved]=useState(false);
  return (
    <main style={{ maxWidth:700, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>My profile</h1>
      <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"24px 26px", boxShadow:"var(--shadow)" }}>
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:6 }}>
          <Avatar name={name || "?"} size={64} />
          <div>
            <div style={{ fontSize:20, fontWeight:800 }}>{name}</div>
            <div style={{ fontSize:14.5, color:"var(--ink-soft)" }}>{ROLE_LABEL[role]} · {profile.title}</div>
          </div>
        </div>
        {profile.org && (
          <div style={{ fontSize:15, marginTop:10, color:"var(--ink-soft)" }}>
            Organization:{" "}
            <button onClick={()=>onOpenClub(profile.org)} style={{ font:"inherit", fontWeight:700, color:"var(--blue)" }}>{profile.org}</button>
          </div>
        )}
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
          <button onClick={()=>{ onSave({ name, bio }); setSaved(true); }} style={{ padding:"11px 22px", borderRadius:11, fontSize:15, fontWeight:700,
            color:"var(--blue)", background:"var(--blue-wash)" }}>Save changes</button>
          {saved && <span style={{ fontSize:14.5, color:"var(--green)", fontWeight:600 }}>✓ Saved</span>}
        </div>
      </div>
    </main>
  );
}
