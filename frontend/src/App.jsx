import { useState, useEffect } from 'react';
import { ROOMS, THREADS, FORUM_POSTS, PROFILES, CLUBS, PEOPLE, getDays } from './data/mock.js';
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
    setProfiles(p => ({ ...p, [r]: { ...p[r], id:user.id, name:user.name, email:user.email } }));
    setThreads([]); setPosts([]); loadConvos();
    if (r !== "venue") { setPostsLoading(true); loadForum().then(() => setPostsLoading(false)); }
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

  const cancelRequest = async (id) => {
    if (api.LIVE) {
      try { await api.cancelRequest(id); setApiError(""); }
      catch (e) { setApiError(e.message); throw e; }
      await loadRequests(role, rooms);
      return;
    }
    setRequests(r => r.map(req => req.id===id ? { ...req, status:"cancelled", reason:"" } : req));
  };

  // ---- messages: conversations between people ----
  const [threads,setThreads]=useState(THREADS);
  const [activeThread,setActiveThread]=useState(null);
  const selfName = profiles[role].name;
  const selfId = profiles[role].id || profiles[role].email;

  const loadConvos = async () => {
    try { setThreads((await api.conversations()).map(api.adaptConversation)); } catch (e) { setApiError(e.message); }
  };
  const searchPeople = (q) => api.LIVE
    ? api.searchUsers(q).then(l => l.map(u => ({ id:u.id, name:u.name, sub:u.email })))
    : Promise.resolve(PEOPLE.filter(p => p.name.toLowerCase().includes(q.toLowerCase())));
  const sendMessage = async (threadId,text) => {
    if (api.LIVE) {
      try { await api.sendMessage(threadId, text); await loadConvos(); setApiError(""); } catch (e) { setApiError(e.message); }
      return;
    }
    setThreads(ts => ts.map(t => t.id===threadId
      ? { ...t, messages:[...t.messages, { id:Date.now(), fromId:selfId, from:selfName, text, time:"Just now" }] } : t));
  };
  const startChat = async (person) => {
    if (person.id === selfId) return;
    const existing = threads.find(t => t.participants.length===2 && t.participants.some(p => p.id===person.id) && t.participants.some(p => p.id===selfId));
    if (existing) { setActiveThread(existing.id); return; }
    if (api.LIVE) {
      try {
        const c = api.adaptConversation(await api.createConversation([person.id]));
        setThreads(ts => ts.some(t => t.id===c.id) ? ts : [...ts, c]);
        setActiveThread(c.id); setApiError("");
      } catch (e) { setApiError(e.message); }
      return;
    }
    const id = Date.now();
    setThreads(ts => [...ts, { id, participants:[{ id:selfId, name:selfName },{ id:person.id, name:person.name }], subject:"", messages:[] }]);
    setActiveThread(id);
  };
  // live: keep conversations fresh while logged in
  useEffect(() => {
    if (!api.LIVE || authView) return;
    const t = setInterval(loadConvos, 12000);
    return () => clearInterval(t);
  }, [authView, role]);

  // unread = messages from other people that this user hasn't opened yet (counts remembered per user in this browser)
  const [seen,setSeen]=useState(() => { try { return JSON.parse(localStorage.getItem("cr_seen") || "{}"); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem("cr_seen", JSON.stringify(seen)); } catch { /* ignore */ } }, [seen]);
  const myThreads = threads.filter(t => t.participants.some(p => p.id===selfId));
  const unreadMap = Object.fromEntries(myThreads.map(t => {
    const n = seen[`${selfId}|${t.id}`] ?? 0;
    return [t.id, t.messages.slice(n).filter(m => m.fromId !== selfId).length];
  }));
  const unreadTotal = Object.values(unreadMap).reduce((x,y)=>x+y, 0);
  useEffect(() => {
    if (authView || page!=="messages" || activeThread==null) return;
    const t = myThreads.find(x => x.id===activeThread);
    const key = `${selfId}|${activeThread}`;
    if (t && seen[key] !== t.messages.length) setSeen(s => ({ ...s, [key]: t.messages.length }));
  });

  // ---- forum ----
  const [posts,setPosts]=useState(FORUM_POSTS);
  const [postsLoading,setPostsLoading]=useState(false);
  const loadForum = async () => {
    try { setPosts((await api.forumPosts()).map(api.adaptPost)); } catch (e) { setApiError(e.message); }
  };
  const addPost = async ({ title, body, category, org }) => {
    if (api.LIVE) {
      await api.createPost({ title, body, category, organization_id: orgIds[org] || null });
      await loadForum(); return;
    }
    setPosts(ps => [{ id:Date.now(), author:selfName, org, category, title, body, replies:[] }, ...ps]);
  };
  const addReply = async (postId, text, org) => {
    if (api.LIVE) { await api.createReply(postId, { body:text, organization_id: orgIds[org] || null }); await loadForum(); return; }
    setPosts(ps => ps.map(p => p.id===postId ? { ...p, replies:[...p.replies, { author:selfName, org, text }] } : p));
  };

  const changeRole = (r, defaultPage) => { setRole(r); setPage(defaultPage); setViewingRoom(null); setViewingClub(null); setActiveThread(null); };
  const openClub = (name) => { setViewingRoom(null); setViewingClub(name); };
  const messagePerson = (person) => { startChat(person); setViewingClub(null); setPage("messages"); };

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
        <ClubProfile name={viewingClub} clubs={clubs} requests={requests} selfId={selfId} onBack={()=>setViewingClub(null)} onMessagePerson={messagePerson} />
      ) : viewingRoom ? (
        <RoomDetail room={viewingRoom} onBack={()=>setViewingRoom(null)} onBook={setOpenRoom} />
      ) : (
        <>
          {role==="leader" && page==="find" && <FindSpace rooms={rooms} loading={roomsLoading} onView={setViewingRoom} onBook={setOpenRoom} />}
          {role==="leader" && page==="requests" && <MyRequests onCancel={cancelRequest} clubs={clubs} requests={requests.filter(r=>leaderOrgs.includes(r.org))} showOrg={leaderOrgs.length>1} />}
          {role==="admin" && page==="approvals" && <Approvals clubs={clubs} requests={requests} onDecide={decide} onOpenClub={openClub} />}
          {role==="admin" && page==="verifications" && <Verifications items={verifs} onApprove={approveVerif} onReject={rejectVerif} onOpenClub={openClub} />}
          {role==="admin" && page==="rooms" && <RoomsAdmin rooms={rooms} requests={requests} loading={roomsLoading} />}
          {role==="venue" && page==="rooms" && <VenueRooms requests={requests} onOpenClub={openClub} />}
          {(role==="leader" || role==="admin") && page==="forum" && <Forum posts={posts} onPost={addPost} onReply={addReply} clubs={role==="leader" ? leaderOrgs : []} loading={postsLoading} onOpenClub={openClub} />}
          {page==="clubs" && <Clubs clubs={clubs} loading={clubsLoading} onOpenClub={openClub} />}
          {page==="profile" && <Profile key={role} role={role} profile={profiles[role]} onOpenClub={openClub}
            onSave={patch=>setProfiles(p=>({ ...p, [role]:{ ...p[role], ...patch } }))}
            memberships={memberships} membershipsLoaded={memLoaded} onSearchOrgs={searchOrgOptions} onJoin={joinOrg} />}
          {page==="messages" && <Messages threads={threads} onSend={sendMessage} onStartChat={startChat}
            activeId={activeThread} setActiveId={setActiveThread} selfId={selfId} onSearchPeople={searchPeople} unreadMap={unreadMap} />}
        </>
      )}

      {openRoom && <BookingDrawer room={openRoom} onClose={()=>setOpenRoom(null)} onSubmit={submitRequest} orgs={leaderOrgs} />}
    </div>
  );
}
