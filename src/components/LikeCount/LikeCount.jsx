"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./LikeCount.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");

function normalizeCount(count) {
  const numericCount = Number(count);

  return Number.isFinite(numericCount)
    ? Math.max(0, Math.trunc(numericCount))
    : 0;
}

export default function LikeCount({
  count = 0,
  size = "md",
  className = "",
  targetType = "business",
  targetId,
  targetName = "this listing",
  initialLiked = false,
  isLoggedIn = false,
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [currentCount, setCurrentCount] = useState(() => normalizeCount(count));
  const [loading, setLoading] = useState(false);
  const [animation, setAnimation] = useState("");
  const normalizedCount = normalizeCount(currentCount);
  const formattedCount = numberFormatter.format(normalizedCount);
  const isInteractive = Boolean(targetId);
  const endpoint = targetType === "event" ? "/api/event-likes" : "/api/likes";
  const idKey = targetType === "event" ? "eventId" : "businessId";
  const accessibleLabel = liked
    ? `Unlike ${targetName}. ${formattedCount} ${normalizedCount === 1 ? "like" : "likes"}.`
    : `Like ${targetName}. ${formattedCount} ${normalizedCount === 1 ? "like" : "likes"}.`;

  async function toggleLike() {
    if (!isInteractive || loading) return;

    if (!isLoggedIn) {
      router.push("/login?next=" + encodeURIComponent(window.location.pathname));
      return;
    }

    const previousLiked = liked;
    const previousCount = normalizedCount;
    const nextLiked = !previousLiked;

    setLoading(true);
    setAnimation(nextLiked ? "like" : "unlike");
    setLiked(nextLiked);
    setCurrentCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idKey]: targetId, liked: nextLiked }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update this like.");
      }

      setLiked(Boolean(data.liked));
      setCurrentCount(normalizeCount(data.count));
    } catch {
      setLiked(previousLiked);
      setCurrentCount(previousCount);
    } finally {
      setLoading(false);
    }
  }

  if (!isInteractive) {
    return (
      <span
        className={[styles.metric, styles[size], className].filter(Boolean).join(" ")}
        role="img"
        aria-label={`${formattedCount} ${normalizedCount === 1 ? "like" : "likes"}`}
      >
        <span className={styles.icon} aria-hidden="true" />
        <span className={styles.count} aria-hidden="true">
          {formattedCount}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={loading}
      aria-label={accessibleLabel}
      aria-pressed={liked}
      aria-busy={loading}
      className={[
        styles.metric,
        styles.button,
        styles[size],
        liked ? styles.liked : "",
        loading ? styles.loading : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      <span
        className={[
          styles.icon,
          animation === "like" ? styles.likeBurst : "",
          animation === "unlike" ? styles.unlikeBurst : "",
        ].filter(Boolean).join(" ")}
        aria-hidden="true"
        onAnimationEnd={() => setAnimation("")}
      />
      <span className={styles.count} aria-live="polite">
        {formattedCount}
      </span>
    </button>
  );
}
