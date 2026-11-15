// True when a request carries anything worth showing (requests made before event details existed carry none).
export const hasDetails = r => !!(r.description || r.headcount || r.includes?.length || r.coHosts?.length || r.advisor);

const row = { fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 6 };
const label = { fontWeight: 700, color: 'var(--ink)' };

// Collapsible "Event details" for a request card (My requests, Approvals). `req` is an adapted request.
export default function RequestDetails({ req, defaultOpen = false }) {
  if (!hasDetails(req)) return null;
  const noSpecials = req.answered !== false && req.includes.length === 0;
  return (
    <details open={defaultOpen} style={{ marginTop: 12, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 13px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14.5 }}>Event details</summary>
      {req.headcount ? <div style={row}><span style={label}>Expected attendance:</span> {req.headcount}</div> : null}
      {req.description && <div style={{ ...row, whiteSpace: 'pre-wrap' }}><span style={label}>About:</span> {req.description}</div>}
      {req.includes.length > 0 && (
        <div style={row}><span style={label}>Includes:</span>
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginLeft: 6, verticalAlign: 'middle' }}>
            {req.includes.map(t => <span key={t} style={{ background: 'var(--blue-wash)', color: 'var(--ink)', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{t}</span>)}
          </span>
        </div>
      )}
      {noSpecials && <div style={row}><span style={label}>Includes:</span> nothing special (no food, sales, A/V, performances, or minors)</div>}
      {req.coHosts.length > 0 && <div style={row}><span style={label}>Co-hosting with:</span> {req.coHosts.join(', ')}</div>}
      {req.advisor && <div style={row}><span style={label}>Program advisor:</span> {req.advisor}</div>}
    </details>
  );
}
