import { useState, useEffect } from 'react';
import { QUESTIONS, EVENT_TYPES, MAX_CO_HOSTS } from '../data/eventDetails.js';

const textBox = { width:"100%", padding:"10px 12px", fontSize:15, border:"2px solid var(--ink)", borderRadius:8, background:"var(--paper)", outline:"none" };
const fieldLabel = { display:"block", fontSize:14.5, fontWeight:700, marginBottom:6 };
const hint = { fontSize:13, color:"var(--ink-faint)", marginTop:5, lineHeight:1.45 };

// The questions 25Live's request form asks beyond name, date and time.
// value/onChange: the form state (see emptyDetails in data/eventDetails.js); org = the club booking;
// eventName/onEventName = the event's name (asked first, here, so people reach it after choosing days); cap = the room's capacity; search(q) -> [{ id, name }] finds other clubs for the co-host picker.
export default function EventDetailsForm({ value: v, onChange, eventName, onEventName, org, cap, search }) {
  const set = patch => onChange({ ...v, ...patch });
  const hc = /^\d+$/.test(v.headcount.trim()) ? Number(v.headcount.trim()) : NaN;
  const overCap = hc >= 1 && cap > 0 && hc > cap;
  const hosts = v.coHosts.filter(c => c.name !== org);

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize:15.6, fontWeight:700, marginBottom:10 }}>About your event</div>
      <div style={{ border:"2px solid var(--ink)", borderRadius:12, padding:"14px 14px 16px", background:"var(--paper)" }}>
        <div style={{ marginBottom:16 }}>
          <label htmlFor="book-event-name" style={fieldLabel}>Event name</label>
          <input id="book-event-name" value={eventName} onChange={e => onEventName(e.target.value)} maxLength={100}
            placeholder="e.g. Spring showcase rehearsal" aria-describedby="book-event-name-hint" style={textBox} />
          <div id="book-event-name-hint" style={hint}>Used for every day. If a day is a different event, give it its own name in "Your selection" above. You can leave this blank if every day has its own name.</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label htmlFor="book-event-type" style={fieldLabel}>Event type</label>
          <select id="book-event-type" value={v.eventType} onChange={e => set({ eventType: e.target.value })} style={textBox}>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={hint}>Pick what best describes the event. Most club events are a Program.</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label htmlFor="book-headcount" style={fieldLabel}>Expected attendance</label>
          <input id="book-headcount" type="number" inputMode="numeric" min={1} step={1} value={v.headcount}
            onChange={e => set({ headcount: e.target.value })} placeholder="e.g. 30" aria-invalid={overCap}
            aria-describedby="book-headcount-hint" style={{ ...textBox, width:140, borderColor: overCap ? "var(--red)" : "var(--ink)" }} />
          <div id="book-headcount-hint" style={overCap ? { ...hint, color:"var(--red)", fontWeight:600 } : hint} role={overCap ? "alert" : undefined}>
            {overCap ? `This room holds ${cap}. Lower the attendance or pick a bigger room.`
              : cap > 0 ? `This room holds ${cap}.` : "Roughly how many people will come."}
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label htmlFor="book-desc" style={fieldLabel}>What's the event?</label>
          <textarea id="book-desc" rows={4} maxLength={2000} value={v.description} onChange={e => set({ description: e.target.value })}
            placeholder="e.g. Open rehearsal for our spring showcase. Members run through two dances and the sound check."
            aria-describedby="book-desc-hint" style={{ ...textBox, resize:"vertical", lineHeight:1.45 }} />
          <div id="book-desc-hint" style={hint}>A sentence or two is plenty. Requests with too little information get denied.</div>
        </div>

        <fieldset style={{ border:"none", padding:0, margin:"0 0 14px" }}>
          <legend style={{ ...fieldLabel, padding:0 }}>What will your event include?</legend>
          <div style={{ ...hint, marginTop:0, marginBottom:6 }}>
            Tick everything that applies. If you leave a box unticked, we send it to 25Live as <b>No</b>, since 25Live asks every one of these. Admins use your answers to check safety and building rules.
          </div>
          {QUESTIONS.map(it => (
            <label key={it.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", fontSize:15, cursor:"pointer" }}>
              <input type="checkbox" checked={!!v.questions[it.key]} style={{ width:18, height:18, accentColor:"#1B2A4A", flexShrink:0 }}
                onChange={e => set({ questions: { ...v.questions, [it.key]: e.target.checked } })} />
              {it.label}
            </label>
          ))}
        </fieldset>

        <CoHostPicker selected={hosts} onChange={coHosts => set({ coHosts })} exclude={org} search={search} />

        <div style={{ marginBottom:16 }}>
          <label htmlFor="book-advisor" style={fieldLabel}>Program advisor <span style={{ fontWeight:500, color:"var(--ink-faint)" }}>(optional)</span></label>
          <input id="book-advisor" value={v.advisor} maxLength={255} placeholder="Name of your club's advisor"
            onChange={e => set({ advisor: e.target.value, advisorTouched: true })} style={textBox} />
          <div style={hint}>Only fill this in if you know it. We'll remember it for next time.</div>
        </div>

        <label style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:15, fontWeight:600, cursor:"pointer" }}>
          <input id="book-policy" type="checkbox" checked={v.policyAgreed} onChange={e => set({ policyAgreed: e.target.checked })}
            style={{ width:18, height:18, marginTop:3, accentColor:"#1B2A4A", flexShrink:0 }} />
          I agree to adhere to all building policies
        </label>
      </div>
    </div>
  );
}

// "Co-hosting with" (optional): search for other clubs and add them as chips.
function CoHostPicker({ selected, onChange, exclude, search }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const full = selected.length >= MAX_CO_HOSTS;

  useEffect(() => {
    const term = q.trim();
    if (!term || !search) { setResults([]); setLoading(false); return; }
    let current = true;
    setLoading(true);
    const t = setTimeout(() => {
      Promise.resolve(search(term))
        .then(list => { if (current) setResults(list || []); })
        .catch(() => { if (current) setResults([]); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(t); };
  }, [q]);   // eslint-disable-line react-hooks/exhaustive-deps

  const taken = new Set([exclude, ...selected.map(c => c.name)]);
  const options = results.filter(o => !taken.has(o.name)).slice(0, 6);
  const add = o => { onChange([...selected, { id: o.id || null, name: o.name }]); setQ(""); setResults([]); };
  const remove = name => onChange(selected.filter(c => c.name !== name));

  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="book-cohost" style={fieldLabel}>Co-hosting with another club <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}>(optional)</span></label>
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {selected.map(c => (
            <span key={c.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--blue-wash)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 14, fontWeight: 600 }}>
              {c.name}
              <button type="button" onClick={() => remove(c.name)} aria-label={`Remove ${c.name}`}
                style={{ width: 22, height: 22, minHeight: 0, borderRadius: 999, fontSize: 15, lineHeight: 1, background: "var(--card)", color: "var(--ink)" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input id="book-cohost" value={q} onChange={e => setQ(e.target.value)} disabled={full} autoComplete="off"
        placeholder={full ? `Up to ${MAX_CO_HOSTS} clubs` : "Search for a club"} style={textBox} />
      {q.trim() && !full && (
        <div style={{ marginTop: 6, border: "1px solid var(--line)", borderRadius: 8, background: "var(--card)", overflow: "hidden" }}>
          {options.map(o => (
            <button key={o.name} type="button" onClick={() => add(o)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 15, background: "var(--card)", borderBottom: "1px solid var(--line-soft)" }}>{o.name}</button>
          ))}
          {options.length === 0 && <div role="status" style={{ padding: "9px 12px", fontSize: 14, color: "var(--ink-faint)" }}>{loading ? "Searching…" : "No other clubs match."}</div>}
        </div>
      )}
      <div style={hint}>Hosting together? Add the other club so both show on the booking.</div>
    </div>
  );
}
