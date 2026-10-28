// Accessibility settings: what can be changed, quick profiles, saving, and applying
// them to the page. Settings are applied as data-a11y-* attributes and CSS variables
// on <html>; a11y.css does the rest. Saved per browser in localStorage.

const KEY = "cr_a11y";

export const DEFAULTS = {
  zoom: 100,              // page zoom, %
  lineHeight: 0,          // 0 = site default, else a multiplier like 1.8
  letterSpacing: 0,       // em
  readableFont: false,
  highlightTitles: false,
  highlightLinks: false,
  align: "",              // "" | "left" | "center" | "right"
  theme: "",              // "" | "dark" | "light" | "contrast"
  saturation: "",         // "" | "mono" | "low" | "high"
  textColor: "",          // custom text color, or ""
  bgColor: "",            // custom background color, or ""
  titleColor: "",         // custom heading color, or ""
  hideImages: false,
  stopAnimations: false,
  focusRing: false,
  bigCursor: false,
  readingGuide: false,
  readingMask: false,
};

// Quick profiles: each one switches on a group of the settings above.
export const PROFILES = {
  seizure:  { label: "Seizure safe",       note: "Stops motion and softens colors",
              values: { stopAnimations: true, saturation: "low" } },
  vision:   { label: "Low vision",         note: "Larger page, stronger contrast and focus",
              values: { zoom: 125, theme: "contrast", focusRing: true, bigCursor: true } },
  adhd:     { label: "ADHD friendly",      note: "Fewer distractions, a reading mask",
              values: { stopAnimations: true, readingMask: true, saturation: "low" } },
  dyslexia: { label: "Dyslexia friendly",  note: "Clear font, wider spacing, left-aligned text on a cream background",
              values: { readableFont: true, lineHeight: 1.8, letterSpacing: 0.08, align: "left", bgColor: "#FFF8DC", readingGuide: true } },
  reading:  { label: "Reading support",    note: "Easier font, spacing, highlighted titles and links",
              values: { readableFont: true, lineHeight: 1.8, letterSpacing: 0.04, highlightTitles: true, highlightLinks: true } },
  keyboard: { label: "Keyboard navigation", note: "A strong outline on whatever has focus",
              values: { focusRing: true } },
};

// Saved state: which profiles are on, plus the settings the user changed by hand.
// Hand-picked settings win over profiles; turning a profile off removes only what it added.
export const EMPTY_STATE = { profiles: [], manual: {} };

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.profiles) && s.manual && typeof s.manual === "object") return s;
  } catch { /* storage unavailable or bad data */ }
  return EMPTY_STATE;
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function effective(state) {
  const fromProfiles = Object.assign({}, ...state.profiles.map(p => PROFILES[p]?.values || {}));
  return { ...DEFAULTS, ...fromProfiles, ...state.manual };
}

export function isDefault(state) {
  return state.profiles.length === 0 && Object.keys(state.manual).length === 0;
}

// Applies settings to <html>. Safe to call on every change.
export function applySettings(s) {
  const root = document.documentElement;
  const flag = (name, on) => (on ? root.setAttribute(`data-a11y-${name}`, "") : root.removeAttribute(`data-a11y-${name}`));
  const value = (name, v) => (v ? root.setAttribute(`data-a11y-${name}`, v) : root.removeAttribute(`data-a11y-${name}`));
  const cssVar = (name, v) => (v !== "" && v != null ? root.style.setProperty(name, String(v)) : root.style.removeProperty(name));

  flag("zoom", s.zoom !== 100);            cssVar("--a11y-zoom", s.zoom !== 100 ? s.zoom / 100 : "");
  flag("line-height", !!s.lineHeight);     cssVar("--a11y-line-height", s.lineHeight || "");
  flag("letter-spacing", !!s.letterSpacing); cssVar("--a11y-letter-spacing", s.letterSpacing ? `${s.letterSpacing}em` : "");
  flag("readable-font", s.readableFont);
  flag("highlight-titles", s.highlightTitles);
  flag("highlight-links", s.highlightLinks);
  value("align", s.align);
  value("theme", s.theme);
  value("saturation", s.saturation);
  flag("text-color", !!s.textColor);       cssVar("--a11y-text", s.textColor);
  flag("bg-color", !!s.bgColor);           cssVar("--a11y-bg", s.bgColor);
  flag("title-color", !!s.titleColor);     cssVar("--a11y-title", s.titleColor);
  flag("hide-images", s.hideImages);
  flag("stop-animations", s.stopAnimations);
  flag("focus-ring", s.focusRing);
  flag("big-cursor", s.bigCursor);
}

// Call before React renders so the page never flashes with the wrong settings.
export function applySavedSettings() {
  applySettings(effective(loadState()));
}