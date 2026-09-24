"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getListingReturnSource, STORAGE_KEY } from "./ListingNavigationTracker";
import styles from "./ListingReturnButton.module.css";

export default function ListingReturnButton({ fallbackHref, fallbackLabel, theme = "light" }) {
  const router = useRouter();
  const [returnContext, setReturnContext] = useState(null);

  useEffect(() => {
    let active = true;
    const showSource = (source, sourceHistoryLength) => queueMicrotask(() => {
      if (active) setReturnContext({ source, sourceHistoryLength });
    });
    const current = window.location.pathname + window.location.search;
    const savedSource = window.history.state?.listingReturnDestination === current
      ? getListingReturnSource(window.history.state.listingReturnSource, current, window.location.origin)
      : null;
    if (savedSource) {
      showSource(savedSource, window.history.state?.listingReturnHistoryLength ?? null);
      return () => { active = false; };
    }

    let tracked = null;
    try {
      tracked = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* Fall back when storage is unavailable. */ }

    let nextSource = tracked?.destination === current
      ? getListingReturnSource(tracked.source, current, window.location.origin)
      : null;
    if (nextSource) {
      window.history.replaceState({
        ...window.history.state,
        listingReturnDestination: current,
        listingReturnSource: nextSource,
        listingReturnHistoryLength: tracked.sourceHistoryLength,
      }, "");
      showSource(nextSource, tracked.sourceHistoryLength ?? null);
    }
    return () => { active = false; };
  }, []);

  const destination = returnContext?.source || fallbackHref;
  const label = returnContext ? "Back to Previous Page" : fallbackLabel;

  function handleClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (returnContext?.sourceHistoryLength && window.history.length === returnContext.sourceHistoryLength + 1) {
      router.back();
    } else {
      router.push(destination);
    }
  }

  return (
    <a href={destination} onClick={handleClick} className={`${styles.button} ${styles[theme]}`}>
      <span className="material-icons" aria-hidden="true">west</span>
      {label}
    </a>
  );
}
