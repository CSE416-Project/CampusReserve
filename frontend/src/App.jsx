import { useState, useEffect } from 'react';
import { ROOMS, THREADS, FORUM_POSTS, PROFILES, getDays } from './data/mock.js';
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
  const submitRequest = (room,picks,org) => {
    setRequests(r => [...r, ...picks.map((p,i) => ({ id:Date.now()+i, room, org, date:p.label, time:p.time, status:"pending" }))]);
  };
  const decide = (id,status,reason) => {
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

  const signIn = (r) => { changeRole(r, HOME[r]); setAuthView(null); };

  if (authView==="login") return <Login onLogin={signIn} onSignup={()=>setAuthView("signup")} />;
  if (authView==="signup") return <CreateAccount onCreate={signIn} onLogin={()=>setAuthView("login")} />;

  return (
    <div>
      <Header role={role} page={page} setPage={p=>{ setPage(p); setViewingRoom(null); setViewingClub(null); }}
        onProfile={()=>{ setPage("profile"); setViewingRoom(null); setViewingClub(null); }} unread={unreadTotal} onLogout={()=>{ setOpenRoom(null); setAuthView("login"); }} />

      {viewingClub ? (
        <ClubProfile name={viewingClub} requests={requests} selfOrg={profiles[role].org} onBack={()=>setViewingClub(null)} onMessage={messageClub} />
      ) : viewingRoom ? (
        <RoomDetail room={viewingRoom} onBack={()=>setViewingRoom(null)} onBook={setOpenRoom} />
      ) : (
        <>
          {role==="leader" && page==="find" && <FindSpace onView={setViewingRoom} onBook={setOpenRoom} />}
          {role==="leader" && page==="requests" && <MyRequests requests={requests.filter(r=>profiles.leader.orgs.includes(r.org))} showOrg={profiles.leader.orgs.length>1} />}
          {role==="admin" && page==="approvals" && <Approvals requests={requests} onDecide={decide} onOpenClub={openClub} />}
          {role==="admin" && page==="rooms" && <RoomsAdmin />}
          {role==="venue" && page==="rooms" && <VenueRooms requests={requests} onOpenClub={openClub} />}
          {(role==="leader" || role==="admin") && page==="forum" && <Forum posts={posts} onPost={addPost} onReply={addReply} onOpenClub={openClub} />}
          {page==="clubs" && <Clubs onOpenClub={openClub} />}
          {page==="profile" && <Profile key={role} role={role} profile={profiles[role]} onOpenClub={openClub}
            onSave={patch=>setProfiles(p=>({ ...p, [role]:{ ...p[role], ...patch } }))} />}
          {page==="messages" && <Messages threads={threads} onSend={sendMessage} onStartChat={startChat}
            activeId={activeThread} setActiveId={setActiveThread} selfName={selfName} unreadMap={unreadMap} />}
        </>
      )}

      {openRoom && <BookingDrawer room={openRoom} onClose={()=>setOpenRoom(null)} onSubmit={submitRequest} orgs={profiles.leader.orgs} />}
    </div>
  );
}
