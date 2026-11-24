import { useEffect, useRef, useState } from 'react';
import { addDays, dayKey, fmtDay, fmtDayLong, nextWeekdays, nextWeekend, parseDay, repeatWeekly } from '../availability.js';

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const short = k => parseDay(k).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ghost = { padding: "5px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1.5px solid var(--ink)", background: "var(--card)", color: "var(--ink)" };

// A small month calendar where you can pick as many days as you like.
// value: sorted day keys ("2026-12-01"). min: the first day that can be picked (today).
export default function MultiDayPicker({ value, onChange, min }) {
  const picked = new Set(value);
  const first = value[0] ? parseDay(value[0]) : parseDay(min);
  const [view, setView] = useState({ y: first.getFullYear(), m: first.getMonth() });
  const [focusKey, setFocusKey] = useState(null);     // the one day that is in the Tab order (arrow keys move it)
  const refs = useRef({});
  const moved = useRef(false);

  const monthStart = new Date(view.y, view.m, 1);
  const lead = monthStart.getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const keyFor = d => dayKey(new Date(view.y, view.m, d));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const minDate = parseDay(min);
  const atMinMonth = view.y === minDate.getFullYear() && view.m === minDate.getMonth();
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const tabKey = (() => {
    if (focusKey && parseDay(focusKey).getMonth() === view.m && parseDay(focusKey).getFullYear() === view.y) return focusKey;
    const inMonth = value.find(k => { const d = parseDay(k); return d.getMonth() === view.m && d.getFullYear() === view.y; });
    if (inMonth) return inMonth;
    for (let d = 1; d <= count; d++) if (keyFor(d) >= min) return keyFor(d);
    return null;
  })();

  useEffect(() => { if (moved.current && focusKey) { refs.current[focusKey]?.focus(); moved.current = false; } });

  const go = delta => setView(v => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const toggle = k => onChange(picked.has(k) ? value.filter(x => x !== k) : [...value, k].sort());
  const onKey = (e, k) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = addDays(k, step);
    if (next < min) return;
    const d = parseDay(next);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    moved.current = true; setFocusKey(next);
  };
  const last = value[value.length - 1];   // quick picks continue after the latest day picked
  const setAll = keys => onChange([...new Set(keys)].filter(k => k >= min).sort());
  // Quick picks add days that may be in another month, so show the month of the first day they added.
  const addDays_ = keys => {
    const added = keys.filter(k => k >= min && !picked.has(k)).sort()[0];
    setAll([...value, ...keys]);
    if (added) { const d = parseDay(added); setView({ y: d.getFullYear(), m: d.getMonth() }); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 6px" }}>
        <button type="button" onClick={() => go(-1)} disabled={atMinMonth} aria-label="Previous month"
          style={{ width: 32, height: 32, borderRadius: 8, border: "2px solid var(--ink)", background: "var(--card)", fontWeight: 700, fontSize: 16 }}>‹</button>
        <div aria-live="polite" style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</div>
        <button type="button" onClick={() => go(1)} aria-label="Next month"
          style={{ width: 32, height: 32, borderRadius: 8, border: "2px solid var(--ink)", background: "var(--card)", fontWeight: 700, fontSize: 16 }}>›</button>
      </div>
      <div role="group" aria-label={`Pick days, ${monthLabel}`}
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, padding: 6, background: "var(--paper)", border: "2px solid var(--ink)", borderRadius: 10 }}>
        {DOW.map((d, i) => <div key={i} aria-hidden="true" style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", padding: "2px 0" }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const k = keyFor(d), past = k < min, on = picked.has(k), today = k === min;
          return (
            <button key={k} type="button" ref={el => { refs.current[k] = el; }} disabled={past} aria-pressed={on}
              aria-label={fmtDayLong(k) + (today ? ", today" : "")} tabIndex={k === tabKey ? 0 : -1}
              onClick={() => { setFocusKey(k); toggle(k); }} onKeyDown={e => onKey(e, k)}
              style={{ height: 36, borderRadius: 8, fontSize: 14, fontWeight: on ? 800 : 500, color: "var(--ink)",
                background: on ? "var(--blue)" : "var(--card)",
                border: on ? "2px solid var(--ink)" : today ? "2px solid var(--link)" : "2px solid transparent",
                opacity: past ? 0.35 : 1 }}>{d}</button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <button type="button" onClick={() => addDays_(nextWeekdays(min, last))} style={ghost}>{last ? `+ 5 weekdays after ${short(last)}` : "+ Next 5 weekdays"}</button>
        <button type="button" onClick={() => addDays_(nextWeekend(min, last))} style={ghost}>{last ? `+ Weekend after ${short(last)}` : "+ Next weekend"}</button>
        {value.length > 0 && <button type="button" onClick={() => addDays_(repeatWeekly(value, 4))} style={ghost}
          title="Adds the same weekdays for the next 3 weeks">↻ Repeat weekly for 4 weeks</button>}
      </div>

      {value.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{value.length} day{value.length === 1 ? "" : "s"} selected</span>
            <button type="button" onClick={() => onChange([])} style={{ fontSize: 13, fontWeight: 600, color: "var(--link)" }}>Clear days</button>
          </div>
          <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, maxHeight: 92, overflowY: "auto", padding: "2px 2px 4px" }}>
            {value.map(k => (
              <li key={k}>
                <button type="button" onClick={() => toggle(k)} aria-label={`Remove ${fmtDayLong(k)}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: "var(--blue-wash)", color: "var(--ink)", border: "1.5px solid var(--link)" }}>
                  {fmtDay(k)} <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 8 }}>Tap one or more days.</div>
      )}
    </div>
  );
}
