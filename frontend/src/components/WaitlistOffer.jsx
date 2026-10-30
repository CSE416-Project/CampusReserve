import { useEffect, useRef } from 'react';
import { waitingAhead, labelOfKey, fmt12 } from './WaitlistPanel.jsx';

// Shown inside BookingDrawer when a picked day/time is already booked or requested.
// days: conflicting day keys; start/end: minutes since midnight; line: room waitlist entries.
export default function WaitlistOffer({ roomName, days, start, end, line, busy, eventName, onJoin }) {
  const ref = useRef(null);
  useEffect(() => { if (days.length) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [days.length > 0]);
  if (days.length === 0) return null;
  const ready = !!eventName.trim();

  return (
    <div ref={ref} style={{ marginTop: 16, border: '2px solid var(--red)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
      <div role="alert" style={{ padding: '12px 16px', background: 'var(--red-wash)', color: 'var(--ink)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)', marginBottom: 4 }}>⚠ Time conflict</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>
          {roomName ? <b>{roomName}</b> : 'This room'} already has a booking or request at {days.length === 1 ? 'this time' : 'these times'}.
          {' '}<b>You can't book it unless the current group cancels.</b>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Want to join the waitlist instead?</div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 10, lineHeight: 1.5 }}>
          You can't request these times yet. If the current group cancels, the next club in line gets the room automatically.
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-faint)', margin: '0 0 4px' }}>
          You'll get a spot in line for each time slot below:
        </div>
        {days.map(k => {
          const n = waitingAhead(line, k, start, end);
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 15 }}>
              <span><b>{labelOfKey(k)}</b> · {fmt12(start)} – {fmt12(end)}</span>
              <span style={{ fontWeight: 700, color: 'var(--link)', whiteSpace: 'nowrap' }}>
                {n === 0 ? "You'd be #1" : `${n} ahead · you'd be #${n + 1}`}
              </span>
            </div>
          );
        })}
        <button disabled={busy || !ready} onClick={() => onJoin()}
          style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 10, fontSize: 15.5, fontWeight: 700, color: 'var(--ink)',
          background: ready ? 'var(--blue)' : 'var(--line-soft)' }}>
          {busy ? 'Joining…' : ready ? 'Join waitlist' : 'Add an event name above to join'}
        </button>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>
          After joining, see your spot under My requests. Your final position is confirmed once you join.
        </div>
      </div>
    </div>
  );
}
