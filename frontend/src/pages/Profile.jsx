import { useState, useEffect } from 'react';
import Avatar from '../components/Avatar.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const field = { width:"100%", padding:"11px 13px", fontSize:15, border:"2px solid var(--ink)", borderRadius:10,
  background:"var(--paper)", outline:"none", marginTop:6 };
const label = { fontSize:14, fontWeight:600, color:"var(--ink-soft)", display:"block", marginTop:16 };
const card = { background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:"24px 26px", boxShadow:"var(--shadow)", marginBottom:22 };
const primary = { padding:"11px 22px", borderRadius:10, fontSize:15, fontWeight:700, color:"var(--ink)", background:"var(--blue)" };

export default function Profile({ role, profile, onSave, onOpenClub, memberships = [], membershipsLoaded = true, onSearchOrgs, onJoin, onChangePassword }) {
  const [name,setName]=useState(profile.name); const [saved,setSaved]=useState(false);
  const [cur,setCur]=useState(""); const [next,setNext]=useState(""); const [confirm,setConfirm]=useState(""); const [pwMsg,setPwMsg]=useState(null); const [pwBusy,setPwBusy]=useState(false);

  // add-a-club form
  const [q,setQ]=useState(""); const [results,setResults]=useState([]); const [chosen,setChosen]=useState(null);
  const [position,setPosition]=useState(""); const [joinMsg,setJoinMsg]=useState(null); const [joining,setJoining]=useState(false);
  const taken = new Set(memberships.map(m => m.name));
  useEffect(()=>{
    if (!onSearchOrgs || chosen || !q.trim()) { setResults([]); return; }
    let off=false;
    const t=setTimeout(()=>{ onSearchOrgs(q.trim()).then(r=>{ if(!off) setResults(r.filter(o=>!taken.has(o.name)).slice(0,6)); }).catch(()=>{ if(!off) setResults([]); }); },200);
    return ()=>{ off=true; clearTimeout(t); };
  },[q,chosen,memberships.length]);
  const sendRequest = async () => {
    if (!chosen) return setJoinMsg({ ok:false, text:"Search for your club or organization and pick it from the list." });
    if (!position.trim()) return setJoinMsg({ ok:false, text:"Enter your position, for example President." });
    setJoining(true); setJoinMsg(null);
    try { await onJoin(chosen, position.trim()); setJoinMsg({ ok:true, text:`✓ Request sent. An admin will verify you for ${chosen.name}.` }); setChosen(null); setQ(""); setPosition(""); }
    catch (e) { setJoinMsg({ ok:false, text:e.message }); }
    setJoining(false);
  };
  const verifiedCount = memberships.filter(m=>m.verified).length;

  const updatePassword = async () => {
    if (!cur) return setPwMsg({ ok:false, text:"Enter your current password." });
    if (next.length < 8) return setPwMsg({ ok:false, text:"New password must be at least 8 characters." });
    if (next !== confirm) return setPwMsg({ ok:false, text:"The new passwords don't match." });
    if (next === cur) return setPwMsg({ ok:false, text:"Choose a new password that is different from your current one." });
    // Connected to the server: it checks the current password and saves the new one.
    // Without a server (demo mode) there is nothing to save, so only the checks above run.
    setPwBusy(true); setPwMsg(null);
    try { if (onChangePassword) await onChangePassword(cur, next); }
    catch (e) { setPwBusy(false); return setPwMsg({ ok:false, text:e.message || "Couldn't change your password." }); }
    setPwBusy(false);
    setPwMsg({ ok:true, text:"✓ Password updated." }); setCur(""); setNext(""); setConfirm("");
  };

  return (
    <main className="page" style={{ maxWidth:700, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:18 }}>My profile</h1>

      <div className="card-pad" style={card}>
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:6 }}>
          <Avatar person name={name || "?"} size={64} />
          <div>
            <div style={{ fontSize:20, fontWeight:800 }}>{name}</div>
          </div>
        </div>
        <label style={label}>Full name
          <input value={name} onChange={e=>{ setName(e.target.value); setSaved(false); }} style={field} />
        </label>
        <label style={label}>SBU email
          <input value={profile.email} readOnly style={{ ...field, color:"var(--ink-faint)" }} />
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20 }}>
          <button onClick={()=>{ onSave({ name }); setSaved(true); }} style={primary}>Save changes</button>
          {saved && <span style={{ fontSize:14.5, color:"var(--green)", fontWeight:600 }}>✓ Saved</span>}
        </div>
      </div>

      {role==="leader" && (
        <div className="card-pad" style={card}>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>My organizations ({memberships.length})</div>
          <div style={{ fontSize:14.5, color:"var(--ink-soft)", marginBottom:14 }}>You can book spaces only for clubs where an admin has verified you as an e-board member.</div>
          {membershipsLoaded && verifiedCount===0 && (
            <div role="status" style={{ background:"var(--amber-wash)", border:"2px solid var(--amber)", borderRadius:10, padding:"12px 14px",
              fontSize:14.5, fontWeight:600, color:"var(--ink)", marginBottom:14 }}>
              Your account is not verified yet. Add your club below. You can request bookings once an admin verifies you.
            </div>
          )}
          <div style={{ display:"grid", gap:10 }}>
            {memberships.map(m => (
              <div key={m.name} style={{ display:"flex", alignItems:"center", gap:12, border:"2px solid var(--ink)", borderRadius:10, padding:"12px 14px", background:"var(--paper)", flexWrap:"wrap" }}>
                <Avatar name={m.name} size={40} />
                <span style={{ flex:1, minWidth:140 }}>
                  <button onClick={()=>onOpenClub(m.name)} style={{ display:"block", fontWeight:700, fontSize:15.5, textAlign:"left", color:"var(--ink)" }}>{m.name}</button>
                  <span style={{ display:"block", fontSize:13.5, color:"var(--ink-soft)" }}>{m.position || "Position not set"}</span>
                </span>
                <span style={{ fontSize:13.5, fontWeight:700, padding:"4px 11px", borderRadius:999, border:"1.5px solid currentColor",
                  color: m.verified ? "var(--green)" : "var(--amber)", background: m.verified ? "var(--green-wash)" : "var(--amber-wash)" }}>
                  {m.verified ? "Verified" : "Not verified · waiting for admin"}
                </span>
              </div>
            ))}
            {!membershipsLoaded && <div style={{ fontSize:14.5, color:"var(--ink-faint)" }}>Loading your organizations…</div>}
            {membershipsLoaded && memberships.length===0 && <div style={{ fontSize:14.5, color:"var(--ink-faint)" }}>You haven't added any clubs yet.</div>}
          </div>

          <div style={{ borderTop:"1px solid var(--line)", marginTop:20, paddingTop:16 }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Add an organization</div>
            <label style={label}>Club or organization
              <div style={{ position:"relative" }}>
                <input id="org-search" value={chosen ? chosen.name : q} onChange={e=>{ setChosen(null); setQ(e.target.value); setJoinMsg(null); }}
                  placeholder="Search by name" style={field} autoComplete="off" />
                {chosen && <button onClick={()=>{ setChosen(null); setQ(""); }} aria-label="Clear club" style={{ position:"absolute", right:10, top:16, width:26, height:26,
                  borderRadius:999, background:"var(--line-soft)", color:"var(--ink)", fontWeight:700 }}>×</button>}
                {results.length>0 && (
                  <div style={{ position:"absolute", left:0, right:0, top:"100%", marginTop:4, background:"var(--card)", border:"2px solid var(--ink)",
                    borderRadius:8, boxShadow:"var(--shadow-lift)", zIndex:5, overflow:"hidden" }}>
                    {results.map(o => (
                      <button key={o.name} onClick={()=>{ setChosen(o); setResults([]); }} style={{ display:"block", width:"100%", textAlign:"left",
                        padding:"10px 12px", fontSize:14.5, color:"var(--ink)", borderBottom:"1px solid var(--line-soft)" }}>{o.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label style={label}>Your position
              <input id="org-position" value={position} onChange={e=>{ setPosition(e.target.value); setJoinMsg(null); }} placeholder="e.g. President, Treasurer" style={field} />
            </label>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:18, flexWrap:"wrap" }}>
              <button onClick={sendRequest} disabled={joining} style={primary}>{joining ? "Sending…" : "Send verification request"}</button>
              {joinMsg && <span role="status" style={{ fontSize:14.5, fontWeight:600, color: joinMsg.ok ? "var(--green)" : "var(--red)" }}>{joinMsg.text}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="card-pad" style={card}>
        <div style={{ fontSize:18, fontWeight:700 }}>Change password</div>
        <label style={label}>Current password
          <PasswordInput value={cur} onChange={e=>{ setCur(e.target.value); setPwMsg(null); }} style={field} />
        </label>
        <label style={label}>New password
          <PasswordInput value={next} onChange={e=>{ setNext(e.target.value); setPwMsg(null); }} placeholder="At least 8 characters" style={field} />
        </label>
        <label style={label}>Confirm new password
          <PasswordInput value={confirm} onChange={e=>{ setConfirm(e.target.value); setPwMsg(null); }} style={field} />
        </label>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20, flexWrap:"wrap" }}>
          <button onClick={updatePassword} disabled={pwBusy} style={primary}>{pwBusy ? "Updating…" : "Update password"}</button>
          {pwMsg && <span role="status" style={{ fontSize:14.5, fontWeight:600, color: pwMsg.ok ? "var(--green)" : "var(--red)" }}>{pwMsg.text}</span>}
        </div>
      </div>
    </main>
  );
}
