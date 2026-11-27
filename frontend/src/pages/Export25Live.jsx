import { useEffect, useState } from 'react';
import * as api from '../api.js';

const card = { background:"var(--card)", border:"2px solid var(--ink)", borderRadius:14, padding:16, boxShadow:"var(--shadow)" };
const btn = { padding:"8px 14px", borderRadius:8, fontSize:14, fontWeight:600 };
const light = { ...btn, background:"var(--line-soft)", color:"var(--ink-soft)" };
const when = iso => new Date(iso).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
const plural = (n, word) => `${n} ${word}${n===1 ? "" : "s"}`;

const row = { fontSize:14, color:"var(--ink-soft)", lineHeight:1.5, marginTop:6 };
const label = { fontWeight:700, color:"var(--ink)" };
const answerText = a => (a === null || a === undefined ? "not asked" : a ? "Yes" : "No");

// Plain-text version of the details, to paste into 25Live's own fields.
function detailsText(item) {
  const d = item.details;
  return [
    `${item.event_name} (${d.event_id})`,
    `${item.organization} · ${item.room} · ${item.date} · ${item.time}`,
    `Requested by: ${d.requester_name} <${d.requester_email}>`,
    `Event type: ${d.event_type}`,
    d.expected_attendance ? `Expected attendance: ${d.expected_attendance}` : null,
    `Setup: ${d.setup_minutes} min · Cleanup: ${d.cleanup_minutes} min`,
    d.co_hosts.length ? `Co-hosting with: ${d.co_hosts.join(", ")}` : null,
    d.program_advisor ? `Program advisor: ${d.program_advisor}` : null,
    d.description ? `About: ${d.description}` : null,
    "Event questions:", ...d.questions.map(q => `  ${q.name}: ${answerText(q.answer)}`),
  ].filter(x => x !== null).join("\n");
}

function Details({ item }) {
  const d = item.details;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(detailsText(item)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked: nothing to do */ }
  };
  return (
    <div style={{ marginTop:8, background:"var(--paper)", border:"1px solid var(--line)", borderRadius:10, padding:"10px 14px" }}>
      <div style={row}><span style={label}>25Live ID:</span> <code>{d.event_id}</code></div>
      <div style={row}><span style={label}>Requested by:</span> {d.requester_name || "unknown"}{d.requester_email ? ` <${d.requester_email}>` : ""}</div>
      <div style={row}><span style={label}>Organization:</span> {d.organization}</div>
      {d.co_hosts.length > 0 && <div style={row}><span style={label}>Co-hosting with:</span> {d.co_hosts.join(", ")}</div>}
      {d.program_advisor && <div style={row}><span style={label}>Program advisor:</span> {d.program_advisor}</div>}
      <div style={row}><span style={label}>Event type:</span> {d.event_type}</div>
      {d.expected_attendance ? <div style={row}><span style={label}>Expected attendance:</span> {d.expected_attendance}</div> : null}
      <div style={row}><span style={label}>Setup / cleanup:</span> {d.setup_minutes} min before, {d.cleanup_minutes} min after</div>
      <div style={{ ...row, whiteSpace:"pre-wrap" }}><span style={label}>About:</span> {d.description || "(no description)"}</div>
      <div style={row}><span style={label}>Event questions:</span>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
          {d.questions.map(q => (
            <span key={q.name} style={{ background: q.answer ? "var(--blue-wash)" : "var(--line-soft)", color:"var(--ink)", borderRadius:999, padding:"2px 10px", fontSize:13, fontWeight:600 }}>
              {q.name}: {answerText(q.answer)}
            </span>
          ))}
        </div>
      </div>
      <button onClick={copy} style={{ ...light, marginTop:10 }}>{copied ? "Copied ✓" : "Copy details"}</button>
    </div>
  );
}

function Booking({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding:"10px 0", borderTop:"1px solid var(--line)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight:700 }}>
            {item.event_name}
            {item.cancelled && <span style={{ marginLeft:8, fontSize:12.5, color:"var(--red)" }}>Cancelled</span>}
            {item.in_25live && !item.cancelled && <span style={{ marginLeft:8, fontSize:12.5, color:"var(--green)" }}>In 25Live ✓</span>}
          </div>
          <div style={{ fontSize:14, color:"var(--ink-faint)" }}>{item.organization} · {item.room} · {item.date} · {item.time}</div>
        </div>
        {item.details && <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={light}>{open ? "Hide details" : "View details"}</button>}
      </div>
      {item.problems?.map(p => <div key={p} style={{ fontSize:14, color:"var(--red)", marginTop:3 }}>{p}</div>)}
      {item.warnings?.map(w => <div key={w} style={{ fontSize:14, color:"var(--amber)", marginTop:3 }}>{w}</div>)}
      {open && item.details && <Details item={item} />}
    </div>
  );
}

function Batch({ b, busy, onDownload, onUndo }) {
  const [open, setOpen] = useState(false);
  const done = b.in_25live >= b.count;
  return (
    <div style={{ padding:"10px 0", borderTop:"1px solid var(--line)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontWeight:700 }}>{when(b.exported_at)} · {plural(b.count, "booking")}</div>
          <div style={{ fontSize:14, color: done ? "var(--green)" : "var(--ink-faint)" }}>
            {done ? "Found in 25Live ✓" : b.in_25live > 0 ? `${b.in_25live} of ${b.count} found in 25Live` : "Not found in 25Live yet"}
          </div>
        </div>
        <div className="btn-row" style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {b.bookings?.length > 0 && <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={light}>{open ? "Hide bookings" : "View bookings"}</button>}
          <button onClick={onDownload} disabled={!!busy} style={light}>Download again</button>
          {!done && <button onClick={onUndo} disabled={!!busy} style={{ ...btn, color:"var(--red)", background:"var(--red-wash)" }}>Undo</button>}
        </div>
      </div>
      {open && <div style={{ marginTop:6, paddingLeft:12, borderLeft:"3px solid var(--line)" }}>
        {b.bookings.map(item => <Booking key={item.id} item={item} />)}
      </div>}
    </div>
  );
}

export default function Export25Live() {
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");          // what is running: "export", a batch id or a request id
  const [includePast,setIncludePast]=useState(false);

  const load = async () => {
    try { setData(await api.exportPreview(includePast)); setError(""); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [includePast]); // eslint-disable-line
  // Other admins approve bookings too: keep the list fresh while this page is open.
  useEffect(() => {
    if (!api.LIVE) return;
    const t = setInterval(() => { if (!document.hidden && !busy) load(); }, 20000);
    return () => clearInterval(t);
  }, [includePast, busy]); // eslint-disable-line

  const run = async (key, work, message) => {
    setBusy(key); setError(""); setNotice("");
    try { const out = await work(); if (message) setNotice(message(out)); }
    catch (e) { setError(e.message); }
    await load();
    setBusy("");
  };
  const saved = file => `Downloaded ${plural(file.count, "booking")} as ${file.filename}.`;

  const downloadNew = () => run("export", async () => {
    const file = await api.exportNew(includePast);
    api.saveTextFile(file.filename, file.csv);
    return file;
  }, f => `${saved(f)} Upload it in 25Live. This page checks 25Live by itself and will show it as uploaded once it appears there (this can take up to about 30 minutes).`);

  const downloadAgain = b => run(b.id, async () => {
    const file = await api.exportBatch(b.id);
    api.saveTextFile(file.filename, file.csv);
    return file;
  }, saved);

  const undo = b => {
    if (!window.confirm(`Put these ${plural(b.count - b.in_25live, "booking")} back in the queue? Only do this if the file was never uploaded to 25Live.`)) return;
    run(b.id, () => api.undoBatch(b.id), r => `${plural(r.released, "booking")} back in the queue.`);
  };

  const cancelDone = c => run(c.id, () => api.cancellationDone(c.id), () => `Marked “${c.event_name}” as cancelled in 25Live.`);

  const ready = data?.ready || [];
  return (
    <main className="page" style={{ maxWidth:900, margin:"0 auto", padding:"26px 24px 60px" }}>
      <h1 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>25Live export</h1>
      <p style={{ color:"var(--ink-soft)", fontSize:15, marginBottom:18, maxWidth:680 }}>
        Approved bookings that aren't in 25Live yet. Download one file at the end of the day, then upload it in 25Live
        (More → Data Import Tool → Import Events CSV). Bookings already in a downloaded file, or that 25Live already has, are left out of the next one.
      </p>

      {!api.LIVE && <div role="note" style={{ background:"var(--amber-wash)", border:"2px solid var(--amber)", borderRadius:10, padding:"10px 16px", marginBottom:14, fontSize:14.5, fontWeight:600 }}>
        Demo data: nothing here is sent anywhere, and it resets when you reload the page.</div>}
      {data && data.upload_check_ok === false && <div role="note" style={{ background:"var(--amber-wash)", border:"2px solid var(--amber)", borderRadius:10, padding:"10px 16px", marginBottom:14, fontSize:14.5, fontWeight:600 }}>
        Couldn't reach 25Live just now, so uploads may not be up to date. Bookings already in 25Live could still be listed below.</div>}
      {error && <div role="alert" style={{ background:"var(--red-wash)", color:"var(--red)", border:"2px solid var(--red)", borderRadius:10, padding:"10px 16px", marginBottom:14, fontWeight:600, fontSize:14.5 }}>{error}</div>}
      {notice && <div role="status" style={{ background:"var(--green-wash)", color:"var(--ink-soft)", borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:14.5 }}>✓ {notice}</div>}

      {!data ? (
        !error && <p role="status" style={{ color:"var(--ink-faint)" }}>Loading…</p>
      ) : (
        <div style={{ display:"grid", gap:16 }}>
          <section style={card} aria-labelledby="ready-h">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <h2 id="ready-h" style={{ fontSize:18, fontWeight:800 }}>Ready to export ({ready.length})</h2>
              <button onClick={downloadNew} disabled={!ready.length || !!busy}
                style={{ ...btn, padding:"9px 16px", color:"var(--ink)", background: ready.length && !busy ? "var(--blue)" : "var(--line-soft)" }}>
                {busy==="export" ? "Preparing…" : ready.length ? `Download CSV (${ready.length})` : "Nothing to download"}
              </button>
            </div>
            <p style={{ fontSize:13.5, color:"var(--ink-faint)", margin:"6px 0 4px" }}>
              Event type: as each request chose (default “Student - Program”) · {data.settings.primary_organization ? `Organization “${data.settings.primary_organization}”` : "Organization: each club's own name"}.
              These must match 25Live exactly.
            </p>
            <label style={{ display:"flex", gap:8, alignItems:"center", fontSize:14, color:"var(--ink-soft)", margin:"4px 0 8px" }}>
              <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)} />
              Include bookings that have already ended
            </label>
            {ready.length === 0
              ? <p style={{ color:"var(--ink-faint)", padding:"10px 0" }}>Every approved booking is already in a file or in 25Live.</p>
              : ready.map(item => <Booking key={item.id} item={item} />)}
          </section>

          {data.skipped.length > 0 && (
            <section style={{ ...card, borderColor:"var(--red)" }} aria-labelledby="skipped-h">
              <h2 id="skipped-h" style={{ fontSize:18, fontWeight:800 }}>Can't be exported ({data.skipped.length})</h2>
              <p style={{ fontSize:14, color:"var(--ink-faint)", margin:"4px 0" }}>These stay in the queue. Enter them in 25Live by hand.</p>
              {data.skipped.map(item => <Booking key={item.id} item={item} />)}
            </section>
          )}

          {data.cancellations.length > 0 && (
            <section style={{ ...card, background:"var(--amber-wash)", borderColor:"var(--amber)" }} aria-labelledby="cancel-h">
              <h2 id="cancel-h" style={{ fontSize:18, fontWeight:800 }}>Cancel in 25Live ({data.cancellations.length})</h2>
              <p style={{ fontSize:14, color:"var(--ink-soft)", margin:"4px 0" }}>
                These were cancelled after they went into a file. If that file was uploaded, cancel the event in 25Live
                (search for its ID), then click Done.
              </p>
              {data.cancellations.map(c => (
                <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap", padding:"10px 0", borderTop:"1px solid var(--amber)" }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{c.event_name}</div>
                    <div style={{ fontSize:14, color:"var(--ink-soft)" }}>{c.organization} · {c.room} · {c.date} · {c.time}</div>
                    <div style={{ fontSize:13, color:"var(--ink-soft)" }}>25Live ID: <code>{c.event_id}</code></div>
                  </div>
                  <button onClick={() => cancelDone(c)} disabled={!!busy} style={{ ...btn, background:"var(--card)", color:"var(--ink)", border:"2px solid var(--ink)" }}>Done</button>
                </div>
              ))}
            </section>
          )}

          <section style={card} aria-labelledby="recent-h">
            <h2 id="recent-h" style={{ fontSize:18, fontWeight:800 }}>Recent downloads</h2>
            {data.batches.length === 0
              ? <p style={{ color:"var(--ink-faint)", padding:"10px 0" }}>No files downloaded yet.</p>
              : data.batches.map(b => (
                  <Batch key={b.id} b={b} busy={busy} onDownload={() => downloadAgain(b)} onUndo={() => undo(b)} />
                ))}
          </section>
        </div>
      )}
    </main>
  );
}
