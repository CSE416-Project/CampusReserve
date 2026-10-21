// Minimal History-API router: keeps the URL and the app's current page in sync
// (so refresh, back/forward and shared links all work) without extra dependencies.
import { useCallback, useEffect, useState } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    // idx counts in-app history entries, so "back" knows whether it can stay inside the app
    const idx = (window.history.state?.idx ?? 0) + (replace ? 0 : 1);
    window.history[replace ? 'replaceState' : 'pushState']({ idx }, '', to);
    setPath(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  // Go back if there is in-app history; otherwise (e.g. opened via a link) go to the fallback.
  const back = useCallback((fallback) => {
    if ((window.history.state?.idx ?? 0) > 0) window.history.back();
    else navigate(fallback, { replace: true });
  }, [navigate]);

  return { path, navigate, back };
}

export const enc = (s) => encodeURIComponent(String(s));
export const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
