const SLOTS = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

export const ALL_FEATURES = [
 "ADA Station",
 "AV - 75in TV",
 "AV - AC Power to Seats",
 "AV - Apple TV/Solstice",
 "AV - Audio",
 "AV - Blu-Ray Player",
 "AV - BYOD AV System (COMPUTER NEEDED)",
 "AV - Clicker ready",
 "AV - Clicker Response System requestable",
 "AV - Computer",
 "AV - Computer Monitor",
 "AV - Data Jack",
 "AV - Digital display",
 "AV - Document Camera",
 "AV - DVD/CD Player",
 "AV - Full Installed AV System",
 "AV - HDMI input for BYOD",
 "AV - Hybrid Equipment",
 "AV - Instructor Station",
 "AV - Interactive SMART Monitor",
 "AV - Interactive Whiteboard",
 "AV - Lectern w/ computer",
 "AV - Lecture Capture (ECHO)",
 "AV - Microphone In Room",
 "AV - Multiple displays",
 "AV - Overhead Projector",
 "AV - Power Outlets",
 "AV - Power Outlets at Seats",
 "AV - Projector",
 "AV - Telephone - Analog",
 "AV - USB-C Input",
 "AV - VGA input for BYOD",
 "AV - Video Conferencing (AV Bridge)",
 "AV - Wall mounted system w/ computer",
 "AV - Wireless Accessible",
 "AV - Wireless keyboard/Mouse",
 "AV - Wireless Mic Available from ClassTech",
 "AV - Wireless Pres/Collab (SOLSTICE)",
 "AV - Zoom Enabled",
 "Basketball - Backboards",
 "Blackboard",
 "Board - 18' or greater Board Space",
 "Board - Chalkboard",
 "Board - Whiteboard",
 "Chairs - Fixed",
 "Chairs - Loose",
 "Chairs - Tablet Arm",
 "Clock",
 "Cocktail Tables",
 "Curtain Wings (Tabler Only)",
 "DoIT Supported",
 "Elevator - Disabled",
 "Fixed",
 "Flag",
 "Flooring - Carpet",
 "Flooring - Hardwood",
 "Flooring - Multiple Activity Center",
 "Flooring - Tile",
 "Food Permitted",
 "Fume Hood - 4 foot",
 "Fume Hood - 6 foot",
 "Gobo Light",
 "Individual Student Desks",
 "Lighting - Blackout",
 "Lighting - Dimmer",
 "Lock/Unlock - Card Access",
 "Lock/Unlock - Lenel",
 "Lock/Unlock - Manual Key Opening",
 "Moveable",
 "Moveable Air Walls",
 "Multipleboards",
 "Periodic Table of Elements",
 "Piano",
 "Piano - Grand",
 "Podium - Fixed",
 "Room Divider - Curtain",
 "Room Divider - Wall Section",
 "Scoreboard",
 "Screen - 8'",
 "Screen - Electric",
 "Screen - Pull Down",
 "Sink",
 "Stage",
 "Stage Skirting",
 "String Lights",
 "Supports Active Learning",
 "Swinging Tablet Desks",
 "Table Skirting",
 "Tables",
 "Tables - Electric at Student Table",
 "Tables - Fixed",
 "Tables - Lab",
 "Tables - Loose",
 "Tables - Round",
 "Tables - Shared Tabletops",
 "Thermostat",
 "Turf",
 "Uplighting",
 "Windows/Natural Lighting"
];

export const BUILDINGS = ["All buildings","Student Activities Center","Staller Center","Melville Library","Union","Javits Lecture Center","Wang Center","Recreation Center"];

export const TYPES = ["Any type","Meeting room","Rehearsal space","Lecture hall","Lounge","Theater"];

export const ROOMS = [
  { id:1, name:"SAC Ballroom A", building:"Student Activities Center", type:"Rehearsal space", cap:300, status:"available",
    features:["Stage", "AV - Audio", "AV - Projector", "ADA Station", "Lighting - Dimmer", "Chairs - Loose", "Food Permitted"], note:"Setup & cleanup time available", closed:false,
    slots:SLOTS, taken:["11:00"], requested:["14:00"] },
  { id:2, name:"Staller Theater Lobby", building:"Staller Center", type:"Lounge", cap:120, status:"requested",
    features:["ADA Station", "Elevator - Disabled", "Flooring - Tile", "Windows/Natural Lighting", "Cocktail Tables", "String Lights"], note:"Requested by Dance Collective — pending approval", closed:false,
    slots:SLOTS, taken:["15:00"], requested:["12:00","13:00"] },
  { id:3, name:"Library Room 2404", building:"Melville Library", type:"Meeting room", cap:18, status:"available",
    features:["Board - Whiteboard", "AV - Computer Monitor", "AV - HDMI input for BYOD", "Tables", "Chairs - Loose", "Power Outlets"], note:"Popular — often waitlisted", closed:false,
    slots:SLOTS, taken:["10:00"], requested:[] },
  { id:4, name:"Recital Hall", building:"Staller Center", type:"Theater", cap:380, status:"unavailable",
    features:["Piano - Grand", "Stage", "Lighting - Dimmer", "AV - Audio", "Chairs - Fixed", "ADA Station"], note:"Building closed for maintenance until Oct 14", closed:true,
    slots:[], taken:[], requested:[] },
  { id:5, name:"Union Room 236", building:"Union", type:"Meeting room", cap:40, status:"available", features:["AV - Projector", "AV - HDMI input for BYOD", "Moveable", "Tables", "Chairs - Loose", "ADA Station"], note:"Setup & cleanup time available", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:6, name:"Group Study 1010", building:"Melville Library", type:"Meeting room", cap:8, status:"available", features:["Board - Whiteboard", "AV - Computer Monitor", "Tables", "Power Outlets"], note:"Popular \u2014 often waitlisted", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:7, name:"SAC Auditorium", building:"Student Activities Center", type:"Theater", cap:400, status:"available", features:["Stage", "AV - Full Installed AV System", "AV - Microphone In Room", "Lighting - Dimmer", "Chairs - Fixed", "Uplighting", "ADA Station"], note:"Setup & cleanup time available", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:8, name:"Javits Lecture Hall 101", building:"Javits Lecture Center", type:"Lecture hall", cap:200, status:"available", features:["AV - Lecture Capture (ECHO)", "AV - Projector", "AV - Lectern w/ computer", "Chairs - Tablet Arm", "Screen - Electric", "Board - Chalkboard"], note:"DoIT supported", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:9, name:"Wang Center Lounge", building:"Wang Center", type:"Lounge", cap:60, status:"requested", features:["Cocktail Tables", "Windows/Natural Lighting", "Food Permitted", "Flooring - Hardwood", "ADA Station"], note:"Requested by another club \u2014 pending approval", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:10, name:"Multipurpose Room B", building:"Recreation Center", type:"Rehearsal space", cap:80, status:"available", features:["Flooring - Hardwood", "Room Divider - Curtain", "AV - Audio", "Piano", "Lock/Unlock - Card Access"], note:"Setup & cleanup time available", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:11, name:"Union Ballroom", building:"Union", type:"Rehearsal space", cap:250, status:"available", features:["Stage", "Curtain Wings (Tabler Only)", "Lighting - Dimmer", "AV - Audio", "Chairs - Loose", "Room Divider - Wall Section"], note:"Setup & cleanup time available", closed:false, slots:SLOTS, taken:[], requested:[] },
  { id:12, name:"Studio Theater", building:"Staller Center", type:"Theater", cap:100, status:"available", features:["Stage", "Lighting - Blackout", "Gobo Light", "Stage Skirting", "Chairs - Loose", "Food Permitted"], note:"Setup & cleanup time available", closed:false, slots:SLOTS, taken:[], requested:[] },
];

export const CONTACTS = ["Robotics Club","Dance Collective","Media Club","K-Pop Dance Crew","Debate Society","Tech Club","A Cappella Group","Venue Host","Student Affairs"];

export const THREADS = [
  { id:1, participants:["Robotics Club","Dance Collective"], subject:"Staller Theater Lobby handoff",
    messages:[
      { from:"Dance Collective", text:"Hey — we have the lobby 12–1 today, looks like you're right after us at 1?", time:"9:40 AM" },
      { from:"Robotics Club", text:"Yep, happy to help move chairs back if that speeds up your teardown.", time:"9:52 AM" },
    ] },
  { id:2, participants:["Robotics Club","Venue Host"], subject:"Ballroom A — sound board access",
    messages:[
      { from:"Venue Host", text:"Approved for 6–9 PM. I'll leave the sound board unlocked for your setup window.", time:"Yesterday" },
    ] },
];

export const FORUM_POSTS = [
  { id:1, org:"Media Club", title:"Anyone have spare folding tables this weekend?",
    body:"We're short two tables for a Saturday event and Facilities is out until Monday. Happy to return them Sunday night.",
    replies:[{ org:"Robotics Club", text:"We have 3 you can borrow — I'll message you." }] },
  { id:2, org:"Dance Collective", title:"Looking to co-host a showcase next month",
    body:"Open to splitting SAC Ballroom A rental and cross-promoting if another performance group wants to co-host.",
    replies:[] },
];

export const STATUS = {
  available:{ label:"Available", fg:"var(--green)", bg:"var(--green-wash)" },
  requested:{ label:"Requested by another club", fg:"var(--amber)", bg:"var(--amber-wash)" },
  unavailable:{ label:"Not bookable", fg:"var(--slate)", bg:"var(--slate-wash)" },
  pending:{ label:"Pending review", fg:"var(--amber)", bg:"var(--amber-wash)" },
  approved:{ label:"Approved", fg:"var(--green)", bg:"var(--green-wash)" },
  denied:{ label:"Denied", fg:"var(--red)", bg:"var(--red-wash)" },
};

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = n => String(n).padStart(2, "0");

export function getDays(n = 14) {
  const out = []; const t = new Date(); t.setHours(0,0,0,0);
  for (let i = 0; i < n; i++) {
    const d = new Date(t); d.setDate(t.getDate() + i);
    out.push({ key:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, dow:DOW[d.getDay()], num:d.getDate(),
      label:`${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

// Mock availability that varies by room, day, and time (a real backend would supply this)
export function slotState(room, dateKey, slot) {
  let h = 0; for (const c of `${room.id}|${dateKey}|${slot}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = h % 10;
  return r < 2 ? "taken" : r < 3 ? "requested" : "open";
}

export const VENUE_HOST_BUILDINGS = ["Student Activities Center","Staller Center"];

export const SB_ENGAGED_URL = "https://sbengaged.stonybrook.edu/submitter/form/start/event-fulfillment";

const ROOM_NOTES = {
  default: {
    instructions: "Arrive 15 minutes before your start time for setup. Return furniture to its original layout, and report any AV or facility issues to the venue host as soon as your event ends.",
    comments: [
      { org:"Media Club", text:"The projector needs about 10 minutes to warm up — plan your setup time around that." },
      { org:"Dance Collective", text:"Floor gets slippery near the entrance right after it rains, heads up." },
    ],
  },
  3: { instructions: "This room seats 18 max at the table — chairs cannot be added. Whiteboard markers are in the front cabinet.",
    comments: [{ org:"Tech Club", text:"Great for small workshops, but the monitor only has HDMI, bring an adapter." }] },
  7: { instructions: "Stage crew access requires a Staller Center key request submitted 72 hours in advance. Full AV system needs a DoIT walkthrough before first use.",
    comments: [{ org:"A Cappella Group", text:"Sound checks run long here — book at least 30 min of setup buffer." }] },
};
export function roomNotes(room) { return ROOM_NOTES[room.id] || ROOM_NOTES.default; }

const EVENT_ORGS = ["Dance Collective","Media Club","K-Pop Dance Crew","Debate Society","Tech Club","A Cappella Group"];
export function upcomingEvents(room) {
  const days = getDays(6);
  const out = [];
  days.forEach((d, i) => {
    if ((room.id + i) % 3 === 0) return;
    const org = EVENT_ORGS[(room.id * 7 + i * 13) % EVENT_ORGS.length];
    const time = room.slots[(room.id + i * 3) % room.slots.length] || "10:00";
    out.push({ date: d.label, time, org, title: i % 2 === 0 ? "Club meeting" : "Rehearsal" });
  });
  return out;
}

export const CLUBS = [
  { name:"Robotics Club", category:"Technical", bio:"We design, build, and compete with autonomous robots, and run weekly build nights open to all majors.",
    eboard:[{name:"Jane Doe",title:"President",holder:true,email:"jane.doe@stonybrook.edu"},{name:"Marcus Lee",title:"Vice President",email:"marcus.lee@stonybrook.edu"},
            {name:"Priya Nair",title:"Treasurer",email:"priya.nair@stonybrook.edu"},{name:"Tom Becker",title:"Secretary",email:"tom.becker@stonybrook.edu"}] },
  { name:"Dance Collective", category:"Performance", bio:"A student-run dance community covering hip-hop, contemporary, and cultural styles, with two showcases a year.",
    eboard:[{name:"Ava Martinez",title:"President",holder:true,email:"ava.martinez@stonybrook.edu"},{name:"Noah Kim",title:"Vice President",email:"noah.kim@stonybrook.edu"},
            {name:"Lena Brooks",title:"Treasurer",email:"lena.brooks@stonybrook.edu"}] },
  { name:"Media Club", category:"Media", bio:"Photography, video, and podcasting for campus events. We cover clubs for free and share gear.",
    eboard:[{name:"Daniel Cho",title:"President",holder:true,email:"daniel.cho@stonybrook.edu"},{name:"Sofia Rossi",title:"Vice President",email:"sofia.rossi@stonybrook.edu"},
            {name:"Omar Haddad",title:"Treasurer",email:"omar.haddad@stonybrook.edu"}] },
  { name:"K-Pop Dance Crew", category:"Performance", bio:"Cover dance practice twice a week and performances at cultural events.",
    eboard:[{name:"Grace Park",title:"President",holder:true,email:"grace.park@stonybrook.edu"},{name:"Ethan Wu",title:"Treasurer",email:"ethan.wu@stonybrook.edu"}] },
  { name:"Debate Society", category:"Academic", bio:"Parliamentary and policy debate, with weekly practice rounds and regional tournaments.",
    eboard:[{name:"Hannah Cole",title:"President",holder:true,email:"hannah.cole@stonybrook.edu"},{name:"Ravi Patel",title:"Vice President",email:"ravi.patel@stonybrook.edu"},
            {name:"Mia Torres",title:"Secretary",email:"mia.torres@stonybrook.edu"}] },
  { name:"Tech Club", category:"Technical", bio:"Workshops, hack nights, and speaker events on software, hardware, and careers in tech.",
    eboard:[{name:"Kevin Zhang",title:"President",holder:true,email:"kevin.zhang@stonybrook.edu"},{name:"Aisha Khan",title:"Vice President",email:"aisha.khan@stonybrook.edu"},
            {name:"Leo Grant",title:"Treasurer",email:"leo.grant@stonybrook.edu"},
            {name:"Jane Doe",title:"Outreach Chair",email:"jane.doe@stonybrook.edu"}] },
  { name:"A Cappella Group", category:"Performance", bio:"Student a cappella group performing pop arrangements at campus concerts and competitions.",
    eboard:[{name:"Isabel Reyes",title:"President",holder:true,email:"isabel.reyes@stonybrook.edu"},{name:"Jack Murphy",title:"Music Director",email:"jack.murphy@stonybrook.edu"}] },
];

export const PROFILES = {
  leader:{ name:"Jane Doe", email:"jane.doe@stonybrook.edu", title:"President", org:"Robotics Club", orgs:["Robotics Club","Tech Club"], bio:"Computer engineering senior. Happy to share build space and tools with other clubs." },
  admin:{ name:"Alex Rivera", email:"alex.rivera@stonybrook.edu", title:"Student Affairs staff", org:null, bio:"Reviews space requests for student organizations." },
  venue:{ name:"Sam Patel", email:"sam.patel@stonybrook.edu", title:"Venue host — SAC & Staller Center", org:null, bio:"Reach out for setup, access, and equipment questions." },
};
