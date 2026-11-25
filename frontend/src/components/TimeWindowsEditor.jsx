import { fmtWindow, windowOk } from '../availability.js';

const PRESETS = [
  { label: "Morning 9–12", from: "09:00", to: "12:00" },
  { label: "Afternoon 12–5", from: "12:00", to: "17:00" },
  { label: "Evening 6–9", from: "18:00", to: "21:00" },
];
const timeBox = { flex: "1 1 0", minWidth: 0, width: "100%", padding: "9px 8px", fontSize: 14.5, border: "2px solid var(--ink)", borderRadius: 8, background: "var(--paper)", outline: "none" };
const ghost = { padding: "5px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1.5px solid var(--ink)", color: "var(--ink)" };
let nextId = 100;

// One or more "from – to" time windows. Every day you pick is checked against every window.
export default function TimeWindowsEditor({ windows, onChange }) {
  const set = (id, patch) => onChange(windows.map(w => w.id === id ? { ...w, ...patch } : w));
  const remove = id => onChange(windows.length > 1 ? windows.filter(w => w.id !== id) : [{ id, from: "", to: "" }]);
  const has = p => windows.some(w => w.from === p.from && w.to === p.to);
  const togglePreset = p => {
    if (has(p)) { const rest = windows.filter(w => !(w.from === p.from && w.to === p.to)); onChange(rest.length ? rest : [{ id: ++nextId, from: "", to: "" }]); return; }
    const empty = windows.find(w => !w.from && !w.to);
    onChange(empty ? windows.map(w => w === empty ? { ...w, from: p.from, to: p.to } : w) : [...windows, { id: ++nextId, from: p.from, to: p.to }]);
  };
  const last = windows[windows.length - 1];

  return (
    <div>
      <div style={{ display: "grid", gap: 8 }}>
        {windows.map((w, i) => {
          const bad = w.from && w.to && !windowOk(w);
          return (
            <div key={w.id}>
              <div role="group" aria-label={`Time ${i + 1}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="time" step="900" value={w.from} onChange={e => set(w.id, { from: e.target.value })} aria-label={`Time ${i + 1}, from`} aria-invalid={bad || undefined} style={timeBox} />
                <span aria-hidden="true" style={{ color: "var(--ink-faint)", fontWeight: 600 }}>to</span>
                <input type="time" step="900" value={w.to} onChange={e => set(w.id, { to: e.target.value })} aria-label={`Time ${i + 1}, to`} aria-invalid={bad || undefined} style={timeBox} />
                {(windows.length > 1 || w.from || w.to) && (
                  <button type="button" onClick={() => remove(w.id)} aria-label={`Remove time ${i + 1}`}
                    style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, background: "var(--line-soft)", fontSize: 18 }}>×</button>
                )}
              </div>
              {bad && <div role="alert" style={{ fontSize: 13.5, color: "var(--red)", fontWeight: 600, marginTop: 4 }}>The end time must be after the start time.</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {PRESETS.map(p => (
          <button key={p.label} type="button" aria-pressed={has(p)} onClick={() => togglePreset(p)} title={fmtWindow(p.from, p.to)}
            style={{ ...ghost, background: has(p) ? "var(--blue-wash)" : "var(--card)", borderColor: has(p) ? "var(--link)" : "var(--ink)" }}>{p.label}</button>
        ))}
      </div>
      {last && windowOk(last) && windows.length < 6 && (
        <button type="button" onClick={() => onChange([...windows, { id: ++nextId, from: "", to: "" }])}
          style={{ fontSize: 13.5, fontWeight: 700, color: "var(--link)", marginTop: 8 }}>+ Add another time</button>
      )}
    </div>
  );
}
