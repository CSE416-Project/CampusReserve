import { useEffect, useState } from 'react';
import * as api from '../api.js';

const RANGES = [7, 30, 90, 365];
const FEATURE_LABELS = {
  room_search:     ["Searching for rooms",     "Availability and filtered search"],
  room_browse:     ["Browsing rooms",          "Room lists, details and schedules"],
  booking:         ["Requesting bookings",     "Checking and submitting requests"],
  booking_changes: ["Changing bookings",       "Editing and cancelling requests"],
  my_requests:     ["Tracking requests",       "Viewing their requests"],
  waitlist:        ["Waitlists",               "Joining, leaving and checking lines"],
  clubs:           ["Clubs",                   "Browsing and joining clubs"],
  notifications:   ["Notifications",           "Reading notifications"],
  calendar:        ["Calendar link",           "Getting the calendar feed"],
  profile:         ["Profile",                 "Memberships and profile"],
  sign_in:         ["Signing in",              "Logins"],
  admin:           ["Admin work",              "Approvals, verifications, rooms"],
};
const STATUS_LABELS = { pending:"Pending", approved:"Approved", denied:"Denied", waitlisted:"Waitlisted", cancelled:"Cancelled" };
const ROLE_LABELS = { club_leader:"Club leaders", admin:"Admins", venue_host:"Venue hosts" };
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const card = { background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:18, boxShadow:"var(--shadow)" };
const h2 = { fontSize:18, fontWeight:800, marginBottom:4 };
const sub = { fontSize:13.5, color:"var(--ink-faint)", marginBottom:14 };
const fmtDay = d => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month:"short", day:"numeric" });
const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
const pct = x => x == null ? "—" : `${Math.round(x * 100)}%`;
const hours = x => x == null ? "—" : x < 1 ? `${Math.round(x * 60)} min` : x < 48 ? `${x} hrs` : `${Math.round(x / 24)} days`;

function Tile({ label, value, note }) {
  return (
    <div style={{ ...card, padding:"14px 16px" }}>
      <div style={{ fontSize:13, fontWeight:600, color:"var(--ink-soft)" }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:800, lineHeight:1.15, margin:"4px 0 2px" }}>{value}</div>
      {note && <div style={{ fontSize:12.5, color:"var(--ink-faint)" }}>{note}</div>}
    </div>
  );
}

// Horizontal bars: one row per item, label and number in text, bar for size.
function BarRows({ items, empty = "No data yet." }) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (items.length === 0) return <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{empty}</div>;
  return (
    <div style={{ display:"grid", gap:10 }}>
      {items.map(i => (
        <div key={i.key ?? i.label} title={`${i.label}: ${i.value.toLocaleString()}${i.extra ? ` · ${i.extra}` : ""}`}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:14, marginBottom:4 }}>
            <span style={{ fontWeight:600, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{i.label}</span>
            <span style={{ color:"var(--ink-soft)", whiteSpace:"nowrap" }}>
              {i.value.toLocaleString()}{i.extra && <span style={{ color:"var(--ink-faint)" }}> · {i.extra}</span>}
            </span>
          </div>
          <div style={{ height:10, background:"var(--paper)", borderRadius:4 }}>
            <div style={{ width:`${(i.value / max) * 100}%`, minWidth: i.value ? 4 : 0, height:"100%", background:"var(--blue)",
              border: i.value ? "1px solid var(--ink)" : "none", borderRadius:4, boxSizing:"border-box" }} />
          </div>
          {i.note && <div style={{ fontSize:12.5, color:"var(--ink-faint)", marginTop:2 }}>{i.note}</div>}
        </div>
      ))}
    </div>
  );
}

// Vertical bars for a series (days, hours, weekdays). Hover a bar for its value.
function Columns({ points, height = 140, labelEvery = 1, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...points.map(p => p.value));
  return (
    <div role="img" aria-label={ariaLabel}>
      <div style={{ height:20, fontSize:13, color:"var(--ink-soft)", fontWeight:600 }}>
        {hover != null ? `${points[hover].label}: ${points[hover].value.toLocaleString()}` : `Peak: ${max.toLocaleString()}`}
      </div>
      <div style={{ display:"flex", alignItems:"flex-end", gap: points.length > 60 ? 1 : 3, height, borderBottom:"2px solid var(--ink)" }}
        onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} title={`${p.label}: ${p.value}`}
            style={{ flex:1, height:"100%", display:"flex", alignItems:"flex-end", cursor:"default" }}>
            <div style={{ width:"100%", height:`${(p.value / max) * 100}%`, minHeight: p.value ? 3 : 0,
              background: hover === i ? "var(--ink)" : "var(--blue)", borderRadius:"4px 4px 0 0" }} />
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap: points.length > 60 ? 1 : 3, marginTop:4 }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex:1, fontSize:11.5, color:"var(--ink-faint)", textAlign:"center", whiteSpace:"nowrap", overflow:"visible" }}>
            {i % labelEvery === 0 ? p.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({ rows, columns }) {
  return (
    <details style={{ marginTop:10 }}>
      <summary style={{ fontSize:13, fontWeight:600, color:"var(--link)", cursor:"pointer" }}>Show as table</summary>
      <table style={{ width:"100%", fontSize:13.5, marginTop:6, borderCollapse:"collapse" }}>
        <thead><tr>{columns.map(c => <th key={c} style={{ textAlign:"left", padding:"4px 6px", borderBottom:"1px solid var(--line-soft)" }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} style={{ padding:"3px 6px" }}>{v}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api.LIVE) return;
    let cancelled = false;
    setLoading(true); setError("");
    api.analytics(days)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  if (!api.LIVE) {
    return <main style={{ maxWidth:1100, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:12 }}>Analytics</h1>
      <div style={card}>Analytics needs the live server. Set VITE_API_URL and log in with a real admin account.</div>
    </main>;
  }

  const u = data?.users, r = data?.requests, o = data?.organizations;
  const every = days <= 14 ? 1 : days <= 31 ? 5 : days <= 90 ? 14 : 60;
  const dayPoints = s => (s || []).map(p => ({ label: fmtDay(p.day), value: p.value }));

  return (
    <main style={{ maxWidth:1100, margin:"0 auto", padding:"26px 24px 60px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:18 }}>
        <h1 style={{ fontSize:26, fontWeight:800 }}>Analytics</h1>
        <div role="group" aria-label="Time range" style={{ display:"flex", gap:6 }}>
          {RANGES.map(n => (
            <button key={n} onClick={() => setDays(n)} aria-pressed={days === n}
              style={{ padding:"7px 12px", borderRadius:10, fontSize:14, fontWeight:600, border:"2px solid var(--ink)", color:"var(--ink)",
                background: days === n ? "var(--blue)" : "var(--card)" }}>
              {n === 365 ? "1 year" : `${n} days`}
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" style={{ ...card, marginBottom:16, color:"var(--red)" }}>Couldn't load analytics: {error}</div>}
      {loading && !data && <div style={{ ...card, color:"var(--ink-faint)" }}>Loading analytics…</div>}

      {data && (
        <div style={{ display:"grid", gap:18, opacity: loading ? 0.6 : 1, transition:"opacity .2s" }}>
          <div style={{ fontSize:13.5, color:"var(--ink-faint)" }}>
            {fmtDay(data.start)} – {fmtDay(data.end)}
            {data.tracking_since
              ? ` · Site usage tracked since ${fmtDay(data.tracking_since)}`
              : " · Site usage tracking has no data yet; it fills in as people use the site."}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:12 }}>
            <Tile label="Active users" value={u.active_in_period.toLocaleString()} note={`in the last ${days} days`} />
            <Tile label="Active this week" value={u.active_last_7_days.toLocaleString()} note="last 7 days" />
            <Tile label="New sign-ups" value={u.new_in_period.toLocaleString()} note={`${u.total.toLocaleString()} accounts total`} />
            <Tile label="Booking requests" value={r.total.toLocaleString()} note={`${r.upcoming_approved} upcoming approved`} />
            <Tile label="Approval rate" value={pct(r.approval_rate)} note="of decided requests" />
            <Tile label="Time to decision" value={hours(r.avg_decision_hours)} note="average, submit → decision" />
          </div>

          <section style={card}>
            <h2 style={h2}>People using the site each day</h2>
            <div style={sub}>Signed-in people who did anything that day.</div>
            <Columns points={dayPoints(u.daily_active)} labelEvery={every} ariaLabel="Daily active users per day" />
            <TableView columns={["Day","Active users"]} rows={u.daily_active.map(p => [fmtDay(p.day), p.value])} />
          </section>

          <section style={card}>
            <h2 style={h2}>What people use CampusReserve for</h2>
            <div style={sub}>Times each feature was used, and by how many people.</div>
            <BarRows empty="No usage recorded yet."
              items={data.features.map(f => ({ key:f.feature, label:(FEATURE_LABELS[f.feature] || [f.feature])[0],
                note:(FEATURE_LABELS[f.feature] || [])[1], value:f.uses, extra:`${f.users} ${f.users === 1 ? "person" : "people"}` }))} />
          </section>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:18 }}>
            <section style={card}>
              <h2 style={h2}>Booking requests submitted</h2>
              <div style={sub}>Per day.</div>
              <Columns points={dayPoints(r.per_day)} labelEvery={every} height={120} ariaLabel="Booking requests submitted per day" />
              <TableView columns={["Day","Requests"]} rows={r.per_day.map(p => [fmtDay(p.day), p.value])} />
            </section>
            <section style={card}>
              <h2 style={h2}>Where requests stand</h2>
              <div style={sub}>Requests submitted in this period, by current status.</div>
              <BarRows items={Object.entries(r.by_status).sort((a,b) => b[1]-a[1])
                .map(([s, n]) => ({ key:s, label:STATUS_LABELS[s] || s, value:n }))} empty="No requests in this period." />
              {r.avg_attendance != null && <div style={{ ...sub, marginTop:12, marginBottom:0 }}>Average expected attendance: {r.avg_attendance}</div>}
            </section>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:18 }}>
            <section style={card}>
              <h2 style={h2}>Most requested rooms</h2>
              <div style={sub}>By booking requests in this period.</div>
              <BarRows items={r.top_rooms.map(x => ({ label:x.name, value:x.count }))} empty="No requests in this period." />
            </section>
            <section style={card}>
              <h2 style={h2}>Most active clubs</h2>
              <div style={sub}>By booking requests in this period.</div>
              <BarRows items={r.top_organizations.map(x => ({ label:x.name, value:x.count }))} empty="No requests in this period." />
            </section>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:18 }}>
            <section style={card}>
              <h2 style={h2}>When events happen: day of week</h2>
              <div style={sub}>By requested event start.</div>
              <Columns points={r.by_weekday.map((n, i) => ({ label:WEEKDAYS[i], value:n }))} height={110} ariaLabel="Requested events by day of week" />
            </section>
            <section style={card}>
              <h2 style={h2}>When events happen: time of day</h2>
              <div style={sub}>By requested event start, 8am to midnight.</div>
              <Columns points={r.by_hour.slice(8).map((n, i) => ({ label:hourLabel(i + 8), value:n }))} height={110} labelEvery={4}
                ariaLabel="Requested events by start hour" />
            </section>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:18 }}>
            <section style={card}>
              <h2 style={h2}>Accounts</h2>
              <div style={sub}>All accounts, by role.</div>
              <BarRows items={Object.entries(u.by_role).sort((a,b) => b[1]-a[1])
                .map(([role, n]) => ({ key:role, label:ROLE_LABELS[role] || role, value:n }))} />
            </section>
            <section style={card}>
              <h2 style={h2}>Clubs</h2>
              <div style={sub}>Organizations on CampusReserve.</div>
              <BarRows items={[
                { label:"Clubs listed", value:o.total },
                { label:"Clubs with a verified member", value:o.with_verified_members },
                { label:"Membership requests waiting", value:o.pending_verifications },
              ]} />
            </section>
          </div>
        </div>
      )}
    </main>
  );
}