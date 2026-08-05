import styles from "./LikeCount.module.css";

const numberFormatter = new Intl.NumberFormat("en-US");

function normalizeCount(count) {
  const numericCount = Number(count);

  return Number.isFinite(numericCount)
    ? Math.max(0, Math.trunc(numericCount))
    : 0;
}

/**
 * Display-only business like metric. It is intentionally not interactive yet.
 */
export default function LikeCount({ count = 0, size = "md", className = "" }) {
  const normalizedCount = normalizeCount(count);
  const formattedCount = numberFormatter.format(normalizedCount);

  return (
    <span
      className={[styles.metric, styles[size], className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${formattedCount} ${normalizedCount === 1 ? "like" : "likes"}`}
    >
      <span className={`material-icons ${styles.icon}`} aria-hidden="true">
        favorite
      </span>
      <span className={styles.count} aria-hidden="true">
        {formattedCount}
      </span>
    </span>
  );
}
