import { useEffect, useRef, useState } from 'react';
import { PROFILES, EMPTY_STATE, loadState, saveState, effective, isDefault, applySettings } from './settings.js';
import useDialog from './useDialog.js';

const ZOOMS = [90, 100, 110, 125, 150, 175, 200];
const LINE_HEIGHTS = [0, 1.5, 1.8, 2.1];
const LETTER_SPACINGS = [0, 0.04, 0.08, 0.12];
const SWATCHES = [
  ["#1B2A4A", "Navy"], ["#000000", "Black"], ["#FFFFFF", "White"], ["#FFF8DC", "Cream"],
  ["#1F5FD1", "Blue"], ["#13795B", "Green"], ["#B8321F", "Red"], ["#6B3FA0", "Purple"],
];

const slug = t => `a11y-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const S = {
  section: { padding:"14px 16px", borderTop:"1px solid var(--line)" },
  h: { fontFamily:"inherit", fontSize:13, fontWeight:800, letterSpacing:".04em", textTransform:"uppercase", color:"var(--ink-soft)", marginBottom:10 },
  row: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, padding:"6px 0" },
  label: { fontSize:14.5, fontWeight:600, color:"var(--ink)" },
  note: { fontSize:12.5, color:"var(--ink-faint)" },
  small: { padding:"6px 10px", borderRadius:8, fontSize:13.5, fontWeight:700, border:"2px solid var(--ink)", color:"var(--ink)", background:"var(--card)" },
};

function Switch({ label, note, checked, onChange }) {
  return (
    <div style={S.row}>
      <div style={{ minWidth:0 }}>
        <div style={S.label}>{label}</div>
        {note && <div style={S.note}>{note}</div>}
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        style={{ flexShrink:0, width:50, height:28, borderRadius:999, border:"2px solid var(--ink)", padding:0, position:"relative",
          background: checked ? "var(--ink)" : "var(--line-soft)", transform:"none", boxShadow:"none" }}>
        <span aria-hidden="true" style={{ position:"absolute", top:2, left: checked ? 24 : 2, width:20, height:20, borderRadius:999,
          background: checked ? "var(--blue)" : "var(--card)", border:"2px solid var(--ink)", transition:"left .15s" }} />
      </button>
    </div>
  );
}

function Stepper({ label, options, value, onChange, format }) {
  const i = Math.max(0, options.indexOf(value));
  return (
    <div style={S.row}>
      <span style={S.label} id={slug(label)}>{label}</span>
      <div role="group" aria-labelledby={slug(label)} style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button aria-label={`Decrease ${label.toLowerCase()}`} disabled={i === 0} onClick={() => onChange(options[i - 1])} style={{ ...S.small, width:34 }}>−</button>
        <span aria-live="polite" style={{ minWidth:64, textAlign:"center", fontSize:14, fontWeight:700 }}>{format(options[i])}</span>
        <button aria-label={`Increase ${label.toLowerCase()}`} disabled={i === options.length - 1} onClick={() => onChange(options[i + 1])} style={{ ...S.small, width:34 }}>+</button>
      </div>
    </div>
  );
}

function Choice({ label, options, value, onChange }) {
  return (
    <div style={{ padding:"6px 0" }}>
      <div style={{ ...S.label, marginBottom:6 }} id={slug(label)}>{label}</div>
      <div role="group" aria-labelledby={slug(label)} style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {options.map(([v, text]) => (
          <button key={v || "default"} aria-pressed={value === v} onClick={() => onChange(v)}
            style={{ ...S.small, background: value === v ? "var(--blue)" : "var(--card)" }}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function Colors({ label, value, onChange }) {
  return (
    <div style={{ padding:"6px 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <span style={S.label} id={slug(label)}>{label}</span>
        {value && <button onClick={() => onChange("")} style={{ fontSize:13, fontWeight:700, color:"var(--link)" }}>Default</button>}
      </div>
      <div role="group" aria-labelledby={slug(label)} style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {SWATCHES.map(([hex, name]) => (
          <button key={hex} aria-label={name} aria-pressed={value === hex} title={name} onClick={() => onChange(value === hex ? "" : hex)}
            style={{ width:28, height:28, borderRadius:999, background:hex, padding:0,
              border: value === hex ? "3px solid var(--link)" : "2px solid var(--ink)",
              outline: value === hex ? "2px solid var(--card)" : "none", outlineOffset:-5 }} />
        ))}
      </div>
    </div>
  );
}

function AccessIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="7" r="1.3" fill="currentColor" />
      <path d="M7 9.5l5 1 5-1M12 10.5v3.5M12 14l-2.5 4.5M12 14l2.5 4.5" />
    </svg>
  );
}

// The reading guide (a line that follows the pointer) and reading mask (dims everything
// except a band around the pointer).
function ReadingAids({ guide, mask }) {
  const [y, setY] = useState(null);
  useEffect(() => {
    if (!guide && !mask) return;
    const move = e => setY(e.clientY);
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [guide, mask]);
  if ((!guide && !mask) || y == null) return null;
  const band = 90, dim = { position:"fixed", left:0, right:0, background:"rgba(10,15,30,.55)", pointerEvents:"none", zIndex:900 };
  return (
    <>
      {mask && <div aria-hidden="true" style={{ ...dim, top:0, height:Math.max(0, y - band / 2) }} />}
      {mask && <div aria-hidden="true" style={{ ...dim, top:y + band / 2, bottom:0 }} />}
      {guide && <div aria-hidden="true" style={{ position:"fixed", left:0, right:0, top:y - 6, height:12, background:"rgba(255,201,60,.45)",
        borderTop:"2px solid #1B2A4A", borderBottom:"2px solid #1B2A4A", pointerEvents:"none", zIndex:901 }} />}
    </>
  );
}

export function SkipLink() {
  return (
    <a href="#main" className="a11y-skip-link" onClick={e => {
      e.preventDefault();
      const main = document.querySelector("#root main");
      if (main) { main.setAttribute("tabindex", "-1"); main.focus(); }
    }}>Skip to main content</a>
  );
}

export default function AccessibilityWidget() {
  const [state, setState] = useState(loadState);
  const [open, setOpen] = useState(false);
  const [headings, setHeadings] = useState([]);
  const panel = useRef(null);
  const s = effective(state);

  useEffect(() => { saveState(state); applySettings(s); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  useDialog(panel, { open, onClose: () => setOpen(false) });

  // Alt+A (Option+A on a Mac) opens and closes the panel from anywhere.
  useEffect(() => {
    const onKey = e => { if (e.altKey && e.code === "KeyA") { e.preventDefault(); setOpen(o => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Jump to" lists the headings on the current page.
  useEffect(() => {
    if (!open) return;
    const list = [...document.querySelectorAll("#root main :is(h1, h2, h3)")]
      .map((el, i) => ({ el, i, text: el.textContent.trim() })).filter(h => h.text);
    setHeadings(list);
  }, [open]);

  const set = (key, value) => setState(st => {
    const manual = { ...st.manual };
    const fromProfiles = effective({ profiles: st.profiles, manual: {} })[key];
    if (value === fromProfiles) delete manual[key]; else manual[key] = value;
    return { ...st, manual };
  });
  const toggleProfile = (id, on) => setState(st => ({
    profiles: on ? [...st.profiles.filter(p => p !== id), id] : st.profiles.filter(p => p !== id),
    manual: on ? Object.fromEntries(Object.entries(st.manual).filter(([k]) => !(k in PROFILES[id].values))) : st.manual,
  }));
  const jumpTo = i => {
    const h = headings.find(x => String(x.i) === i);
    if (!h) return;
    setOpen(false);
    setTimeout(() => {
      h.el.setAttribute("tabindex", "-1");
      h.el.scrollIntoView({ block:"start", behavior: s.stopAnimations ? "auto" : "smooth" });
      h.el.focus({ preventScroll:true });
    }, 0);
  };
  const changed = !isDefault(state);

  return (
    <>
      <ReadingAids guide={s.readingGuide} mask={s.readingMask} />

      <button onClick={() => setOpen(o => !o)} aria-label="Accessibility settings" aria-expanded={open} aria-controls="a11y-panel"
        title="Accessibility settings (Alt+A)"
        style={{ position:"fixed", left:20, bottom:20, zIndex:1000, width:58, height:58, borderRadius:999,
          background:"#1F5FD1", color:"#FFFFFF", border:"3px solid #FFFFFF", boxShadow:"0 0 0 2px #1B2A4A, 3px 3px 0 2px #1B2A4A",
          display:"grid", placeItems:"center" }}>
        <AccessIcon />
        {changed && <span aria-hidden="true" style={{ position:"absolute", top:-2, right:-2, width:16, height:16, borderRadius:999,
          background:"#FFC93C", border:"2px solid #1B2A4A" }} />}
      </button>

      {open && (
        <div ref={panel} id="a11y-panel" role="dialog" aria-modal="true" aria-labelledby="a11y-title" tabIndex={-1}
          style={{ position:"fixed", left:20, bottom:92, zIndex:1000, width:390, maxWidth:"calc(100vw - 40px)", maxHeight:"calc(100vh - 120px)",
            overflowY:"auto", background:"var(--card)", color:"var(--ink)", border:"3px solid var(--ink)", borderRadius:16,
            boxShadow:"var(--shadow-lift)", fontFamily:"'DM Sans', system-ui, sans-serif" }}>
          <div style={{ position:"sticky", top:0, zIndex:1, background:"var(--card)", padding:"14px 16px", display:"flex",
            alignItems:"center", justifyContent:"space-between", gap:8, borderBottom:"2px solid var(--ink)" }}>
            <h2 id="a11y-title" style={{ fontSize:19, color:"var(--ink)" }}>Accessibility</h2>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setState(EMPTY_STATE)} disabled={!changed} style={S.small}>Reset all</button>
              <button onClick={() => setOpen(false)} aria-label="Close accessibility settings" style={{ ...S.small, width:34 }}>×</button>
            </div>
          </div>

          <div style={{ ...S.section, borderTop:"none" }}>
            <h3 style={S.h}>Quick profiles</h3>
            {Object.entries(PROFILES).map(([id, p]) => (
              <Switch key={id} label={p.label} note={p.note} checked={state.profiles.includes(id)} onChange={on => toggleProfile(id, on)} />
            ))}
          </div>

          <div style={S.section}>
            <h3 style={S.h}>Text</h3>
            <Stepper label="Page size" options={ZOOMS} value={s.zoom} onChange={v => set("zoom", v)} format={v => `${v}%`} />
            <Stepper label="Line spacing" options={LINE_HEIGHTS} value={s.lineHeight} onChange={v => set("lineHeight", v)}
              format={v => (v ? `${v}×` : "Default")} />
            <Stepper label="Letter spacing" options={LETTER_SPACINGS} value={s.letterSpacing} onChange={v => set("letterSpacing", v)}
              format={v => (v ? `+${Math.round(v * 100)}%` : "Default")} />
            <Switch label="Readable font" note="Atkinson Hyperlegible, designed for low vision" checked={s.readableFont} onChange={v => set("readableFont", v)} />
            <Switch label="Highlight headings" checked={s.highlightTitles} onChange={v => set("highlightTitles", v)} />
            <Switch label="Highlight links" checked={s.highlightLinks} onChange={v => set("highlightLinks", v)} />
            <Choice label="Text alignment" value={s.align} onChange={v => set("align", v)}
              options={[["", "Default"], ["left", "Left"], ["center", "Center"], ["right", "Right"]]} />
          </div>

          <div style={S.section}>
            <h3 style={S.h}>Color</h3>
            <Choice label="Theme" value={s.theme} onChange={v => set("theme", v)}
              options={[["", "Default"], ["dark", "Dark"], ["light", "Light"], ["contrast", "High contrast"]]} />
            <Choice label="Saturation" value={s.saturation} onChange={v => set("saturation", v)}
              options={[["", "Default"], ["mono", "Monochrome"], ["low", "Low"], ["high", "High"]]} />
            <Colors label="Text color" value={s.textColor} onChange={v => set("textColor", v)} />
            <Colors label="Heading color" value={s.titleColor} onChange={v => set("titleColor", v)} />
            <Colors label="Background color" value={s.bgColor} onChange={v => set("bgColor", v)} />
          </div>

          <div style={S.section}>
            <h3 style={S.h}>Navigation</h3>
            <Switch label="Stop animations" checked={s.stopAnimations} onChange={v => set("stopAnimations", v)} />
            <Switch label="Hide images" checked={s.hideImages} onChange={v => set("hideImages", v)} />
            <Switch label="Strong focus outline" note="Shows clearly what the keyboard is on" checked={s.focusRing} onChange={v => set("focusRing", v)} />
            <Switch label="Big cursor" checked={s.bigCursor} onChange={v => set("bigCursor", v)} />
            <Switch label="Reading guide" note="A line that follows your pointer" checked={s.readingGuide} onChange={v => set("readingGuide", v)} />
            <Switch label="Reading mask" note="Dims everything except where you're reading" checked={s.readingMask} onChange={v => set("readingMask", v)} />
            <label style={{ display:"block", padding:"8px 0 2px" }}>
              <span style={S.label}>Jump to a section</span>
              <select value="" onChange={e => jumpTo(e.target.value)} disabled={headings.length === 0}
                style={{ display:"block", width:"100%", marginTop:6, padding:"8px 10px", fontSize:14.5, borderRadius:8,
                  border:"2px solid var(--ink)", background:"var(--paper)" }}>
                <option value="">{headings.length ? "Choose a section…" : "No sections on this page"}</option>
                {headings.map(h => <option key={h.i} value={String(h.i)}>{h.text}</option>)}
              </select>
            </label>
          </div>

          <div style={{ ...S.section, ...S.note }}>
            Tip: press <kbd>Alt</kbd>+<kbd>A</kbd> (<kbd>Option</kbd>+<kbd>A</kbd> on a Mac) to open this panel. Settings are saved in this browser.
          </div>
        </div>
      )}
    </>
  );
}
