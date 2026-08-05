"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SaveButton.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");

function normalizeCount(count) {
  const numericCount = Number(count);

  return Number.isFinite(numericCount)
    ? Math.max(0, Math.trunc(numericCount))
    : 0;
}

/**
 * Reusable save/unsave bookmark button.
 *
 * Props:
 *   businessId    – string
 *   businessName  – string (optional, used in the accessible name)
 *   initialSaved  – boolean
 *   initialCount  – number
 *   isLoggedIn    – boolean
 *   size          – "sm" | "md" | "lg" | "hero"  (default "md")
 */
export default function SaveButton({
  businessId,
  businessName,
  initialSaved  = false,
  initialCount  = 0,
  isLoggedIn    = false,
  size          = "md",
}) {
  const router  = useRouter();
  const [saved,   setSaved]   = useState(initialSaved);
  const [count,   setCount]   = useState(() => normalizeCount(initialCount));
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/login?next=" + encodeURIComponent(window.location.pathname));
      return;
    }

    setLoading(true);

    // Optimistic update
    setSaved((s) => !s);
    setCount((c) => saved ? Math.max(0, c - 1) : c + 1);

    try {
      const res = await fetch("/api/favorites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ businessId }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
        setCount(normalizeCount(data.count));
      } else {
        setSaved((s) => !s);
        setCount((c) => saved ? c + 1 : Math.max(0, c - 1));
      }
    } catch {
      setSaved((s) => !s);
      setCount((c) => saved ? c + 1 : Math.max(0, c - 1));
    } finally {
      setLoading(false);
    }
  }

  const normalizedCount = normalizeCount(count);
  const formattedCount = numberFormatter.format(normalizedCount);
  const businessLabel = businessName?.trim() || "this business";
  const accessibleLabel = saved
    ? `Remove ${businessLabel} from your saved businesses. ${formattedCount} ${normalizedCount === 1 ? "save" : "saves"}.`
    : `Save ${businessLabel} to your saved businesses. ${formattedCount} ${normalizedCount === 1 ? "save" : "saves"}.`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={accessibleLabel}
      aria-pressed={saved}
      aria-busy={loading}
      className={[
        styles.btn,
        styles[size],
        saved ? styles.saved : "",
        loading ? styles.loading : "",
      ].filter(Boolean).join(" ")}
    >
      <span className={"material-icons " + styles.icon} aria-hidden="true">
        {saved ? "bookmark" : "bookmark_border"}
      </span>
      <span className={styles.label} aria-live="polite">
        {formattedCount}
      </span>
    </button>
  );
}
