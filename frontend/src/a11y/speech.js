// Read aloud: speaks page text with the browser's built-in speech (Web Speech API).
// This is for sighted people who find reading hard. Blind users have their own
// screen reader (VoiceOver, NVDA, JAWS, TalkBack); the site supports those through
// proper labels and structure instead.

export const supported = typeof window !== "undefined" && "speechSynthesis" in window;

const HIGHLIGHT = "a11y-speaking";
let queue = [];          // [{ text, el }]
let current = null;      // the item being spoken
let opts = { rate: 1, voice: "" };
let status = { speaking: false, paused: false };
const listeners = new Set();

const emit = () => listeners.forEach(fn => fn(status));
export function subscribe(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
export function setOptions(o) { opts = { ...opts, ...o }; }

export function voices() {
  if (!supported) return [];
  return speechSynthesis.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
}

function mark(el, on) { if (el) el.classList.toggle(HIGHLIGHT, on); }

// Long text is cut into sentence-sized pieces: some browsers stop speaking
// after about 15 seconds of a single utterance.
function chunks(text, max = 220) {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?;:]+[.!?;:]*\s*/g) || [];
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function next() {
  mark(current?.el, false);
  current = queue.shift() || null;
  if (!current) { status = { speaking: false, paused: false }; emit(); return; }
  const u = new SpeechSynthesisUtterance(current.text);
  u.rate = opts.rate;
  u.lang = document.documentElement.lang || "en";
  const v = opts.voice && speechSynthesis.getVoices().find(x => x.name === opts.voice);
  if (v) u.voice = v;
  u.onend = next;
  u.onerror = e => { if (e.error !== "interrupted" && e.error !== "canceled") next(); };
  mark(current.el, true);
  if (current.el && !current.el.closest("#a11y-root")) current.el.scrollIntoView({ block: "nearest" });
  status = { speaking: true, paused: false }; emit();
  speechSynthesis.speak(u);
}

export function stop() {
  if (!supported) return;
  queue = [];
  mark(current?.el, false);
  current = null;
  speechSynthesis.cancel();
  status = { speaking: false, paused: false }; emit();
}

// items: [{ text, el? }]. Replaces whatever is being read.
export function speak(items) {
  if (!supported) return;
  stop();
  queue = items.flatMap(({ text, el }) => chunks(text).map(t => ({ text: t, el })));
  next();
}
export const speakText = (text, el) => text && text.trim() && speak([{ text, el }]);

export function pause() { if (supported && status.speaking) { speechSynthesis.pause(); status = { speaking: true, paused: true }; emit(); } }
export function resume() { if (supported && status.paused) { speechSynthesis.resume(); status = { speaking: true, paused: false }; emit(); } }

// ---- What to read ---------------------------------------------------------------

// Hidden from everyone (aria-hidden or not displayed). Text that's only for listeners
// (.sr-only, like "3 unread") is still read.
const isHidden = el => !el || el.closest("[aria-hidden='true']")
  || (el.offsetParent === null && getComputedStyle(el).position !== "fixed" && !el.closest(".sr-only"));
const CONTROL = "button, a, label, [role='button'], [role='switch'], [role='link']";
const isBlock = el => !getComputedStyle(el).display.startsWith("inline");

// The nearest block-level ancestor: the "paragraph" a piece of text belongs to.
export function blockOf(node) {
  let el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el.parentElement && !isBlock(el)) el = el.parentElement;
  return el;
}

// The page's text in reading order, grouped into blocks (headings, paragraphs, cards...).
export function pageBlocks(root) {
  // An open popup (like the booking drawer) is what's on screen, so read that instead.
  root = root || document.querySelector("#root [role='dialog'][aria-modal='true']")
    || document.querySelector("#root main") || document.querySelector("#root");
  if (!root) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.textContent.trim() && !isHidden(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const blocks = [];
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    // Buttons, links and labels are read on their own, by their accessible name
    // (so a "×" button is read as "Close booking", not as part of the paragraph).
    const control = n.parentElement.closest(CONTROL);
    if (control && root.contains(control)) {
      if (seen.has(control)) continue;
      seen.add(control);
      const name = control.getAttribute("aria-label") || control.innerText.trim();
      if (name) blocks.push({ el: control, text: name });
      continue;
    }
    const el = blockOf(n);
    const last = blocks[blocks.length - 1];
    if (last && last.el === el) last.text += " " + n.textContent.trim();
    else blocks.push({ el, text: n.textContent.trim() });
  }
  return blocks;
}

// What a screen reader would announce for a focused control: its name, role and state.
export function describe(el) {
  if (!el || el === document.body) return "";
  const byId = id => document.getElementById(id)?.textContent.trim() || "";
  const name = el.getAttribute("aria-label")
    || (el.getAttribute("aria-labelledby") || "").split(/\s+/).map(byId).join(" ").trim()
    || (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : "")
    || el.getAttribute("title") || el.getAttribute("placeholder") || el.textContent.trim() || el.getAttribute("alt") || "";
  const tag = el.tagName.toLowerCase(), type = (el.getAttribute("type") || "").toLowerCase();
  const role = el.getAttribute("role")
    || (tag === "a" ? "link" : tag === "button" ? "button" : tag === "select" ? "menu"
      : tag === "textarea" || (tag === "input" && !["checkbox", "radio", "range", "button", "submit"].includes(type)) ? "text field"
      : type === "checkbox" ? "checkbox" : type === "radio" ? "radio button" : type === "range" ? "slider" : "");
  const states = [];
  if (el.getAttribute("aria-pressed") === "true") states.push("selected");
  if (el.getAttribute("aria-checked") === "true" || el.checked) states.push(role === "switch" ? "on" : "checked");
  else if (el.getAttribute("aria-checked") === "false" || type === "checkbox") states.push(role === "switch" ? "off" : "not checked");
  if (el.getAttribute("aria-expanded") === "true") states.push("expanded");
  if (el.getAttribute("aria-current") === "page") states.push("current page");
  if (el.disabled) states.push("unavailable");
  if (el.getAttribute("aria-invalid") === "true") states.push("invalid");
  const value = (tag === "input" || tag === "textarea") && type !== "password" && el.value ? `, ${el.value}` : "";
  const selected = tag === "select" && el.selectedOptions?.[0] ? `, ${el.selectedOptions[0].textContent.trim()}` : "";
  return [name.replace(/\s+/g, " ").slice(0, 200) + value + selected, role, ...states].filter(Boolean).join(", ");
}