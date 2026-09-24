"use client";

import { useEffect } from "react";

const STORAGE_KEY = "txlocalist:listing-return";

export function isListingPath(pathname) {
  return /^\/business\/[^/]+\/?$/.test(pathname)
    || (/^\/events\/[^/]+\/?$/.test(pathname) && pathname !== "/events/results");
}

export function getListingReturnSource(rawSource, destination, origin) {
  if (!rawSource) return null;
  try {
    const source = new URL(rawSource, origin);
    const target = new URL(destination, origin);
    if (source.origin !== origin || target.origin !== origin) return null;
    if (source.pathname === target.pathname && source.search === target.search) return null;
    return source.pathname + source.search + source.hash;
  } catch {
    return null;
  }
}

export default function ListingNavigationTracker() {
  useEffect(() => {
    function rememberSource(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;

      let destination;
      try { destination = new URL(anchor.href); } catch { return; }
      if (destination.origin !== window.location.origin || !isListingPath(destination.pathname)) return;

      const source = getListingReturnSource(window.location.href, destination.href, window.location.origin);
      if (!source) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          destination: destination.pathname + destination.search,
          source,
          sourceHistoryLength: window.history.length,
        }));
      } catch { /* Storage may be disabled; the detail page still has a fallback. */ }
    }

    document.addEventListener("click", rememberSource, true);
    return () => document.removeEventListener("click", rememberSource, true);
  }, []);

  return null;
}

export { STORAGE_KEY };
