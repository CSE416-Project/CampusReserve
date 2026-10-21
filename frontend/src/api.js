// Thin client for the CampusReserve FastAPI server.
// Live mode is ON only when VITE_API_URL is set (see .env.example); otherwise the app runs on mock data.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const LIVE = !!BASE;

let token = null;
try { token = sessionStorage.getItem("cr_token"); } catch { /* storage unavailable */ }
export const hasToken = () => !!token;
export function setToken(t) {
  token = t;
  try { t ? sessionStorage.setItem("cr_token", t) : sessionStorage.removeItem("cr_token"); } catch { /* ignore */ }
}

function errorMessage(data, status) {
  const d = data && data.detail;
  if (typeof d === "string") return d;
  if (d && typeof d.message === "string") return d.message;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return `Request failed (${status})`;
}

async function call(path, { method = "GET", json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  let res;
  try { res = await fetch(BASE + path, { method, headers, body }); }
  catch { throw new Error("Can't reach the server. Is it running on " + BASE + "?"); }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    if (res.status === 401 && token && path !== "/auth/token") setToken(null);
    throw new Error(errorMessage(data, res.status));
  }
  return data;
}

// ---- auth -------------------------------------------------------------
export async function login(email, password) {
  const t = await call("/auth/token", { method: "POST", form: { username: email.trim(), password } });
  setToken(t.access_token);
  return call("/auth/me");
}
export const me = () => call("/auth/me");
export const register = (email, name, password) =>
  call("/auth/register", { method: "POST", json: { email: email.trim(), name: name.trim(), password } });
export const searchOrgs = q => call("/organizations?search=" + encodeURIComponent(q));
export const joinOrg = (id, position_title) =>
  call(`/organizations/${id}/join`, { method: "POST", json: { position_title: position_title || null } });
export const memberships = () => call("/me/memberships");
export const orgs = () => call("/organizations");
export const orgDetail = id => call(`/organizations/${id}`);
export const adaptClub = o => ({ id:o.id, name:o.name, category:null, bio:o.description || "", count:o.verified_member_count || 0, eboard:null, live:true });

// ---- rooms ------------------------------------------------------------
export const rooms = () => call("/rooms");
export const roomSchedule = (id, startKey, endKey) =>
  call(`/rooms/${encodeURIComponent(id)}/schedule?start=${startKey}&end=${endKey}`);

// ---- requests ---------------------------------------------------------
export const myRequests = () => call("/requests/mine");
export const adminRequests = status => call(`/admin/requests?status=${status}&limit=200`).then(items => items.map(i => i.request));
export const createRequest = body => call("/requests", { method: "POST", json: body });
export const approve = id => call(`/requests/${id}/approve`, { method: "POST", json: {} });
export const deny = (id, reason) => call(`/requests/${id}/deny`, { method: "POST", json: { reason } });

// ---- waitlist ---------------------------------------------------------
export const roomWaitlist = id => call(`/waitlist/rooms/${encodeURIComponent(id)}`);
export const leaveWaitlist = id => call(`/requests/${id}/waitlist`, { method: "DELETE" });

// ---- adapters: server shapes -> the shapes the UI already uses ---------
export const SLOTS = ["9:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
export const ROLE_FROM_SERVER = { club_leader: "leader", admin: "admin", venue_host: "venue" };

export function adaptRoom(r) {
  return {
    id: r.id, name: r.name, building: r.building || "Other locations", cap: r.capacity || 0,
    type: r.room_type || "Space",
    features: [...new Set([...(r.live25_features || []), ...(r.features || [])])],
    status: r.club_bookable === false ? "unavailable" : "available",
    closed: r.club_bookable === false,
    note: r.pending_requests ? `${r.pending_requests} pending request${r.pending_requests === 1 ? "" : "s"}` : "Open for requests",
    slots: SLOTS, live: true,
  };
}

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const p2 = n => String(n).padStart(2, "0");
export const dayKeyOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function adaptRequest(r, roomsById = {}) {
  const s = new Date(r.start_time);
  const room = roomsById[r.room_id] || { id: r.room_id, name: r.room_name || "Room", building: "" };
  const status = r.status === "waitlisted" ? "pending" : (r.status === "cancelled" ? "denied" : r.status);
  return { id: r.id, room, org: r.organization_name || "", date: `${DOW[s.getDay()]}, ${MON[s.getMonth()]} ${s.getDate()}`,
    time: `${p2(s.getHours())}:${p2(s.getMinutes())}–${p2(new Date(r.end_time).getHours())}:${p2(new Date(r.end_time).getMinutes())}`, status, reason: r.decision_reason || (r.status === "cancelled" ? "Cancelled" : ""),
    event: r.event_name };
}

// Busy intervals per day from schedule items: { "2026-10-21": [[startMin, endMin, "booked"|"requested"], ...] }
export function busyFromSchedule(items) {
  const out = {};
  for (const it of items) {
    if (it.kind === "waitlist") continue;   // waitlist entries don't block a slot
    const start = new Date(it.start), end = new Date(it.end);
    const state = it.source === "25live" || it.status === "approved" || it.kind === "closed" ? "booked" : "requested";
    for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d < end; d.setDate(d.getDate() + 1)) {
      const dayStart = d.getTime(), dayEnd = dayStart + 86400000;
      const s0 = Math.max(start.getTime(), dayStart), e0 = Math.min(end.getTime(), dayEnd);
      if (e0 <= s0) continue;
      (out[dayKeyOf(d)] ||= []).push([Math.round((s0 - dayStart) / 60000), Math.round((e0 - dayStart) / 60000), state]);
    }
  }
  return out;
}

const hhmm = m => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
// One booking request for a picked day and time range ("HH:MM" start/end).
export function requestBody(room, orgId, pick, eventName) {
  return { organization_id: orgId, room_id: String(room.id), event_name: eventName || "Club event",
    start_time: `${pick.key}T${pick.start}`, end_time: `${pick.key}T${pick.end}` };
}
export { hhmm };

// ---- verification ------------------------------------------------------
// Admin: every unverified membership request, one row each.
export async function pendingVerifications() {
  const users = await call("/admin/users?awaiting_verification=true");
  return users.flatMap(u => u.memberships.filter(m => !m.verified).map(m => ({
    id: `${m.organization_id}|${u.id}`, userId: u.id, userName: u.name, email: u.email,
    orgId: m.organization_id, orgName: m.organization_name, position: m.position_title || "" })));
}
export const verifyMember = (orgId, userId, position) =>
  call(`/admin/organizations/${orgId}/members/${userId}/verify`, { method: "POST", json: { position_title: position || null } });
export const rejectMember = (orgId, userId) =>
  call(`/admin/organizations/${orgId}/members/${userId}`, { method: "DELETE" });