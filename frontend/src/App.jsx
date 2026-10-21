import { useState, useEffect } from 'react';
import { ROOMS, THREADS, FORUM_POSTS, PROFILES, CLUBS, getDays } from './data/mock.js';
import Header from './components/Header.jsx';
import FindSpace from './pages/FindSpace.jsx';
import RoomDetail from './pages/RoomDetail.jsx';
import BookingDrawer from './pages/BookingDrawer.jsx';
import MyRequests from './pages/MyRequests.jsx';
import Approvals from './pages/Approvals.jsx';
import RoomsAdmin from './pages/RoomsAdmin.jsx';
import VenueRooms from './pages/VenueRooms.jsx';
import Messages from './pages/Messages.jsx';
import Forum from './pages/Forum.jsx';
import Clubs from './pages/Clubs.jsx';
import ClubProfile from './pages/ClubProfile.jsx';
import Profile from './pages/Profile.jsx';
import Login from './pages/Login.jsx';
import CreateAccount from './pages/CreateAccount.jsx';
import Verifications from './pages/Verifications.jsx';
import { setKnownClubs } from './components/OrgLink.jsx';
import * as api from './api.js';

const D = getDays(3);
const HOME = { leader:"find", admin:"approvals", venue:"rooms" };
const SELF_ORG = { leader:"Robotics Club", admin:"Student Affairs", venue:"Venue Host" };

export default function App() {
  const [authView,setAuthView]=useState("login"); // "login" | "signup" | null once signed in
  const [role,setRole]=useState("leader");
  const [page,setPage]=useState("find");
  const [viewingRoom,setViewingRoom]=useState(null);
  const [viewingClub,setViewingClub]=useState(null);
  const [profiles,setProfiles]=useState(PROFILES);
  const [openRoom,setOpenRoom]=useState(null);

  const [requests,setRequests]=useState([
    { id:1, room:ROOMS[1], org:"Dance Collective", date:D[1].label, time:"12:00", status:"pending" },
    { id:2, room:ROOMS[0], org:"Robotics Club", date:D[2].label, time:"18:00", status:"approved" },
    { id:3, room:ROOMS[2], org:"Tech Club", date:D[1].label, time:"16:00", status:"approved" },
    { id:4, room:ROOMS[4], org:"Media Club", date:D[2].label, time:"14:00", status:"approved" },
  ]);
  // ---- live mode (FastAPI server) ----
  const [rooms,setRooms]=useState(ROOMS);
  const [roomsLoading,setRoomsLoading]=useState(false);
  const [apiError,setApiError]=useState("");

  // clubs: mock data by default; the database's organizations in live mode
  const [clubs,setClubs]=useState(() => CLUBS.map(c => ({ ...c, count:c.eboard.length })));
  const [clubsLoading,setClubsLoading]=useState(false);
  setKnownClubs(clubs.map(c => c.name));
  const loadClubs = async () => {
    setClubsLoading(true);
    try { setClubs((await api.orgs()).map(api.adaptClub)); } catch (e) { setApiError(e.message); }
    setClubsLoading(false);
  };

  // memberships: this leader's clubs and whether an admin has verified them
  const [memberships,setMemberships]=useState(() => CLUBS.flatMap(c => c.eboard.filter(m => m.email === PROFILES.leader.email)
    .map(m => ({ orgId:null, name:c.name, position:m.title, verified:true }))));
  // admin: membership requests waiting for verification
  const [verifs,setVerifs]=useState([
    { id:"v1", userName:"Priya Shah", email:"priya.shah@stonybrook.edu", orgName:"Debate Society", position:"Treasurer" },
    { id:"v2", userName:"Marcus Lee", email:"marcus.lee@stonybrook.edu", orgName:"Media Club", position:"Vice President" },
  ]);
  const [memLoaded,setMemLoaded]=useState(true); // false while a live login is still fetching the user's clubs
  const leaderOrgs = memberships.filter(m => m.verified).map(m => m.name);
  const orgIds = Object.fromEntries(memberships.filter(m => m.verified && m.orgId).map(m => [m.name, m.orgId]));

  const loadMemberships = async () => {
    try {
      const ms = await api.memberships();
      setMemberships(ms.map(m => ({ orgId:m.organization_id, name:m.organization_name, position:m.position_title || "", verified:m.verified })));
    } catch (e) { setApiError(e.message); }
    setMemLoaded(true);
  };
  const loadVerifs = async () => { try { setVerifs(await api.pendingVerifications()); } catch (e) { setApiError(e.message); } };
  const searchOrgOptions = (q) => api.LIVE
    ? api.searchOrgs(q).then(l => l.map(o => ({ id:o.id, name:o.name })))
    : Promise.resolve(CLUBS.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).map(c => ({ id:null, name:c.name })));
  const joinOrg = async (org, position) => {
    if (api.LIVE) { await api.joinOrg(org.id, position); await loadMemberships(); return; }
    setMemberships(ms => [...ms, { orgId:null, name:org.name, position, verified:false }]);
    setVerifs(v => [...v, { id:`m-${Date.now()}`, userName:profiles.leader.name, email:profiles.leader.email, orgName:org.name, position, mock:true }]);
  };
  const approveVerif = async (it) => {
    try {
      if (api.LIVE) { await api.verifyMember(it.orgId, it.userId, it.position); await loadVerifs(); }
      else {
        setVerifs(v => v.filter(x => x.id !== it.id));
        if (it.mock) setMemberships(ms => ms.map(m => m.name === it.orgName ? { ...m, verified:true } : m));
      }
      setApiError("");
    } catch (e) { setApiError(e.message); throw e; }
  };
  const rejectVerif = async (it) => {
    try {
      if (api.LIVE) { await api.rejectMember(it.orgId, it.userId); await loadVerifs(); }
      else {
        setVerifs(v => v.filter(x => x.id !== it.id));
        if (it.mock) setMemberships(ms => ms.filter(m => m.name !== it.orgName));
      }
      setApiError("");
    } catch (e) { setApiError(e.message); throw e; }
  };

  const loadRequests = async (r, roomList) => {
    const byId = Object.fromEntries(roomList.map(x => [x.id, x]));
    try {
      let raw;
      if (r==="admin") {
        const [p,a,d] = await Promise.all([api.adminRequests("pending"), api.adminRequests("approved"), api.adminRequests("denied")]);
        raw = [...p,...a,...d];
      } else raw = await api.myRequests();
      setRequests(raw.map(x => api.adaptRequest(x, byId)));
    } catch (e) { setApiError(e.message); }
  };
  const loadLive = async (r, user) => {
    setRequests([]); setRoomsLoading(true); setApiError("");
    setMemberships([]); setVerifs([]); setMemLoaded(r !== "leader"); loadClubs();
    setProfiles(p => ({ ...p, [r]: { ...p[r], name:user.name, email:user.email } }));
    let roomList = [];
    try { roomList = (await api.rooms()).map(api.adaptRoom); setRooms(roomList); }
    catch (e) { setApiError(e.message); }
    setRoomsLoading(false);
    if (r==="leader") await loadMemberships();
    if (r==="admin") await loadVerifs();
    await loadRequests(r, roomList);
  };

  // returns the picks that failed ([] when every day was requested)
  const submitRequest = async (room,picks,org) => {
    if (api.LIVE) {
      const orgId = orgIds[org];
      if (!orgId) throw new Error("You aren't verified for a club yet. Add your club in your profile and wait for an admin to verify you.");
      const failed = [];
      for (const p of picks) {
        try { await api.createRequest(api.requestBody(room, orgId, p, `${org} event`)); }
        catch (e) { failed.push({ pick:p, msg:e.message }); }
      }
      await loadRequests(role, rooms);
      return failed;
    }
    setRequests(r => [...r, ...picks.map((p,i) => ({ id:Date.now()+i, room, org, date:p.label, time:`${p.start}–${p.end}`, status:"pending" }))]);
    return [];
  };
  const decide = async (id,status,reason) => {
    if (api.LIVE) {
      try { status==="approved" ? await api.approve(id) : await api.deny(id, reason); setApiError(""); }
      catch (e) { setApiError(e.message); }
      await loadRequests(role, rooms);
      return;
    }
    setRequests(r => r.map(req => req.id===id ? { ...req, status, reason } : req));
  };

  const [threads,setThreads]=useState(THREADS);
  const [activeThread,setActiveThread]=useState(null);
  const selfName = SELF_ORG[role];
  const sendMessage = (threadId,text) => {
    setThreads(ts => ts.map(t => t.id===threadId
      ? { ...t, messages:[...t.messages, { from:selfName, text, time:"Just now" }] } : t));
  };
  const startChat = (contact) => {
    const existing = threads.find(t => t.participants.includes(selfName) && t.participants.includes(contact));
    if (existing) { setActiveThread(existing.id); return; }
    const id = Date.now();
    setThreads(ts => [...ts, { id, participants:[selfName,contact], subject:"New conversation", messages:[] }]);
    setActiveThread(id);
  };

  // unread = messages from the other person that this identity hasn't opened yet
  const [seen,setSeen]=useState({});
  const myThreads = threads.filter(t => t.participants.includes(selfName));
  const unreadMap = Object.fromEntries(myThreads.map(t => {
    const n = seen[`${selfName}|${t.id}`] ?? 0;
    return [t.id, t.messages.slice(n).filter(m => m.from !== selfName).length];
  }));
  const unreadTotal = Object.values(unreadMap).reduce((x,y)=>x+y, 0);
  useEffect(() => {
    if (authView || page!=="messages" || activeThread==null) return;
    const t = myThreads.find(x => x.id===activeThread);
    const key = `${selfName}|${activeThread}`;
    if (t && seen[key] !== t.messages.length) setSeen(s => ({ ...s, [key]: t.messages.length }));
  });

  const [posts,setPosts]=useState(FORUM_POSTS);
  const addPost = (title,body) => setPosts(ps => [{ id:ps.length+1, org:selfName, title, body, replies:[] }, ...ps]);
  const addReply = (postId,text) => setPosts(ps => ps.map(p => p.id===postId ? { ...p, replies:[...p.replies, { org:selfName, text }] } : p));

  const changeRole = (r, defaultPage) => { setRole(r); setPage(defaultPage); setViewingRoom(null); setViewingClub(null); setActiveThread(null); };
  const openClub = (name) => { setViewingRoom(null); setViewingClub(name); };
  const messageClub = (name) => { startChat(name); setViewingClub(null); setPage("messages"); };

  const signIn = (r, user) => { changeRole(r, HOME[r]); setAuthView(null); if (api.LIVE && user) loadLive(r, user); };

  if (authView==="login") return <Login onLogin={signIn} onSignup={()=>setAuthView("signup")} />;
  if (authView==="signup") return <CreateAccount onCreate={signIn} onLogin={()=>setAuthView("login")} />;

  return (
    <div>
      <Header role={role} page={page} setPage={p=>{ setPage(p); setViewingRoom(null); setViewingClub(null); }}
        onProfile={()=>{ setPage("profile"); setViewingRoom(null); setViewingClub(null); }} unread={unreadTotal} verifCount={verifs.length} name={profiles[role].name} onLogout={()=>{ setOpenRoom(null); api.setToken(null); setAuthView("login"); }} />
      {apiError && <div role="alert" style={{ maxWidth:900, margin:"14px auto 0", padding:"10px 16px", background:"var(--red-wash)", color:"var(--red)", border:"2px solid var(--red)", borderRadius:10, fontWeight:600, fontSize:14.5 }}>{apiError}</div>}

      {role==="leader" && memLoaded && leaderOrgs.length===0 && page!=="profile" && (
        <div role="status" style={{ maxWidth:900, margin:"14px auto 0", padding:"10px 16px", background:"var(--amber-wash)", border:"2px solid var(--amber)",
          borderRadius:10, fontWeight:600, fontSize:14.5, color:"var(--ink)", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ flex:1, minWidth:200 }}>Your account is not verified yet, so you can't request bookings.</span>
          <button onClick={()=>{ setPage("profile"); setViewingRoom(null); setViewingClub(null); }} style={{ padding:"6px 12px", borderRadius:8, border:"2px solid var(--ink)", color:"var(--ink)", background:"var(--card)", fontWeight:700, fontSize:14 }}>Add your club</button>
        </div>
      )}

      {viewingClub ? (
        <ClubProfile name={viewingClub} clubs={clubs} requests={requests} selfOrg={profiles[role].org} onBack={()=>setViewingClub(null)} onMessage={messageClub} />
      ) : viewingRoom ? (
        <RoomDetail room={viewingRoom} onBack={()=>setViewingRoom(null)} onBook={setOpenRoom} />
      ) : (
        <>
          {role==="leader" && page==="find" && <FindSpace rooms={rooms} loading={roomsLoading} onView={setViewingRoom} onBook={setOpenRoom} />}
          {role==="leader" && page==="requests" && <MyRequests clubs={clubs} requests={requests.filter(r=>leaderOrgs.includes(r.org))} showOrg={leaderOrgs.length>1} />}
          {role==="admin" && page==="approvals" && <Approvals clubs={clubs} requests={requests} onDecide={decide} onOpenClub={openClub} />}
          {role==="admin" && page==="verifications" && <Verifications items={verifs} onApprove={approveVerif} onReject={rejectVerif} onOpenClub={openClub} />}
          {role==="admin" && page==="rooms" && <RoomsAdmin />}
          {role==="venue" && page==="rooms" && <VenueRooms requests={requests} onOpenClub={openClub} />}
          {(role==="leader" || role==="admin") && page==="forum" && <Forum posts={posts} onPost={addPost} onReply={addReply} onOpenClub={openClub} />}
          {page==="clubs" && <Clubs clubs={clubs} loading={clubsLoading} onOpenClub={openClub} />}
          {page==="profile" && <Profile key={role} role={role} profile={profiles[role]} onOpenClub={openClub}
            onSave={patch=>setProfiles(p=>({ ...p, [role]:{ ...p[role], ...patch } }))}
            memberships={memberships} membershipsLoaded={memLoaded} onSearchOrgs={searchOrgOptions} onJoin={joinOrg} />}
          {page==="messages" && <Messages threads={threads} onSend={sendMessage} onStartChat={startChat}
            activeId={activeThread} setActiveId={setActiveThread} selfName={selfName} unreadMap={unreadMap} />}
        </>
      )}

      {openRoom && <BookingDrawer room={openRoom} onClose={()=>setOpenRoom(null)} onSubmit={submitRequest} orgs={leaderOrgs} />}
    </div>
  );
}
