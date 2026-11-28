// Makes the "Page zoom" accessibility setting (low vision) work with the responsive layout.
//
// The zoom is CSS `zoom` on #root. Browsers still pick media queries (and size vh/dvh units)
// from the real window, so at 125% a 900px-wide window got the tablet layout for what is
// really 720px of room, and full-height pieces came out 25% taller than the screen.
// This scales every width breakpoint by the zoom (in our stylesheets and in useMedia) and
// divides viewport heights by it inside the page, so the layout matches what fits.

let zoom = 1;
const listeners = new Set();
const originalMedia = new WeakMap();   // CSSMediaRule -> its media text as written
const originalProps = new WeakMap();   // CSSStyleRule -> { property: [value, priority] } as written
const VH = /(-?\d*\.?\d+)((?:d|s|l)?vh)\b/g;

const round = n => Math.round(n * 100) / 100;

// "(max-width: 639px)" at zoom 1.25 -> "(max-width: 798.75px)"
export function scaleQuery(query, z = zoom) {
  if (z === 1) return query;
  return query.replace(/((?:min|max)-width\s*:\s*)(\d*\.?\d+)px/g, (_, pre, n) => `${pre}${round(Number(n) * z)}px`);
}

export const layoutZoom = () => zoom;
export function onLayoutZoomChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function fixRules(rules) {
  for (const r of rules) {
    if (typeof CSSMediaRule !== "undefined" && r instanceof CSSMediaRule) {
      if (!originalMedia.has(r)) originalMedia.set(r, r.media.mediaText);
      const want = scaleQuery(originalMedia.get(r));
      if (r.media.mediaText !== want) r.media.mediaText = want;
    }
    // (Style rules have a cssRules list too, for nested CSS, so this also walks into those.)
    if (r.cssRules && r.cssRules.length) fixRules(r.cssRules);  // @media, @supports, @layer, nesting
    // Viewport heights inside the zoomed page. The accessibility widget sits outside it: leave it alone.
    if (!r.style || !r.selectorText || r.selectorText.includes(".a11y-")) continue;
    let saved = originalProps.get(r);
    if (!saved) {
      saved = {};
      for (const p of r.style) { const v = r.style.getPropertyValue(p); if (VH.test(v)) saved[p] = [v, r.style.getPropertyPriority(p)]; VH.lastIndex = 0; }
      originalProps.set(r, saved);
    }
    for (const [p, [v, prio]] of Object.entries(saved)) {
      r.style.setProperty(p, zoom === 1 ? v : v.replace(VH, (_, n, u) => `calc(${n}${u} / ${zoom})`), prio);
    }
  }
}

function fixAllStyles() {
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }     // another site's stylesheet: not ours
    if (rules) fixRules(rules);
  }
}

let watching = false;
function watchNewStyles() {
  if (watching || typeof MutationObserver === "undefined") return;
  watching = true;
  // Stylesheets added later (Vite adds them as pages load) get the same treatment.
  new MutationObserver(muts => {
    if (zoom === 1) return;
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.tagName === "STYLE") fixAllStyles();
      else if (n.tagName === "LINK") n.addEventListener("load", fixAllStyles, { once: true });
    }
  }).observe(document.head, { childList: true });
}

// Called by applySettings with the page zoom as a factor (1.25 for 125%).
export function setLayoutZoom(z) {
  z = Number(z) || 1;
  if (z === zoom) return;
  zoom = z;
  fixAllStyles();
  watchNewStyles();
  listeners.forEach(fn => fn(zoom));
}
