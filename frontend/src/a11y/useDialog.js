import { useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Makes a popup behave like a proper dialog for keyboard and screen-reader users:
// focus moves into it when it opens, Tab stays inside it, Escape closes it, and
// focus goes back to whatever opened it when it closes.
export default function useDialog(ref, { open = true, onClose } = {}) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current;
    const opener = document.activeElement;
    const items = () => [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);

    // Focus the first thing inside, or the panel itself.
    const first = items()[0];
    (first || panel).focus({ preventScroll: true });

    const onKey = e => {
      if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const firstEl = list[0], lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    panel.addEventListener("keydown", onKey);
    return () => {
      panel.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}