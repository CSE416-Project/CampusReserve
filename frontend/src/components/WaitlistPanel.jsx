import { useState } from 'react';

// ---- shared helpers (also used by WaitlistOffer) ----
const p2 = n => String(n).padStart(2, '0');
export const dayKeyOfIso = iso => iso.slice(0, 10);
export const minutesOfIso = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
export const fmt12 = m => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${p2(m % 60)} ${h < 12 ? 'AM' : 'PM'}`; };
export const labelOfKey = k => { const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };

// How many people are already waiting for a slot that overlaps [startMin, endMin) on `key`.
export const waitingAhead = (line, key, startMin, endMin) =>
  line.filter(e => dayKeyOfIso(e.start) === key && minutesOfIso(e.start) < endMin && minutesOfIso(e.end) > startMin).length;

// ---- Room detail sidebar card ----
export default function WaitlistPanel({ room, line = [], loading = false, error = '', onJoin, onLeave }) {
  const [confirmId, setConfirmId] = useState(null);
  const sorted = [...line].sort((a, b) => a.start.localeCompare(b.start) || a.position - b.position);
  const byDay = sorted.reduce((acc, e) => { (acc[dayKeyOfIso(e.start)] ||= []).push(e); return acc; }, {});
  const days = Object.keys(byDay);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 19, fontWeight: 700 }}>Waitlist</div>
        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 14, fontWeight: 700,
          background: line.length ? 'var(--blue-wash)' : 'var(--line-soft)', color: 'var(--ink)' }}>
          {line.length} waiting
        </span>
      </div>

      <div style={{ background: 'var(--card)', border: '2px solid var(--ink)', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 16, color: 'var(--ink-faint)' }}>Loading waitlist…</div>
        ) : error ? (
          <div role="alert" style={{ padding: 16, fontSize: 16, color: 'var(--red)' }}>{error}</div>
        ) : days.length === 0 ? (
          <div style={{ padding: 16, fontSize: 16, color: 'var(--ink-faint)' }}>Nobody is waiting for this room right now.</div>
        ) : days.map((k, di) => (
          <div key={k} style={{ borderBottom: di < days.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ padding: '8px 15px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink-soft)', background: 'var(--paper)' }}>
              {labelOfKey(k)}
            </div>
            {byDay[k].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 15px',
                background: e.is_yours ? 'var(--blue-wash)' : 'transparent' }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 800,
                  fontSize: 14, border: '2px solid var(--ink)', background: e.is_yours ? 'var(--blue)' : 'var(--card)', flexShrink: 0 }}>
                  {e.position}
                </div>
                <div style={{ flex: 1, fontSize: 15.5 }}>
                  {fmt12(minutesOfIso(e.start))} – {fmt12(minutesOfIso(e.end))}
                  {e.is_yours && <b style={{ marginLeft: 8, fontSize: 13 }}>You</b>}
                </div>
                {e.is_yours && (confirmId === e.request_id ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { onLeave?.(e.request_id); setConfirmId(null); }}
                      style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--red)', background: 'var(--red-wash)' }}>Leave</button>
                    <button onClick={() => setConfirmId(null)}
                      style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)', background: 'var(--line-soft)' }}>Keep</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(e.request_id)}
                    style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--link)' }}>Leave</button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, color: 'var(--ink-faint)', margin: '10px 2px 12px', lineHeight: 1.5 }}>
        Spots are per time slot. If the group ahead of you cancels, the next in line is approved automatically. Other clubs' names stay private.
      </div>
      {!room.closed && onJoin && (
        <button onClick={() => onJoin(room)} style={{ width: '100%', padding: '11px', borderRadius: 10, fontSize: 16, fontWeight: 700,
          color: 'var(--ink)', background: 'var(--blue)' }}>Join a waitlist</button>
      )}
    </div>
  );
}
