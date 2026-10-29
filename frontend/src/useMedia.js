import { useEffect, useState } from 'react';

// Screen-size breakpoints. Keep these in sync with responsive.css.
export const PHONE = "(max-width: 639px)";      // phones
export const COMPACT = "(max-width: 1023px)";   // phones and tablets: bottom tab bar instead of the top nav

// True while the media query matches; updates when the window is resized or the phone is rotated.
export function useMedia(query) {
  const get = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, [query]);
  return match;
}

export const useIsPhone = () => useMedia(PHONE);
export const useIsCompact = () => useMedia(COMPACT);

// Stops the page behind a full-screen sheet from scrolling while the sheet is open.
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}
