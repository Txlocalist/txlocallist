import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.loader} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span>Loading Texas Localist</span>
      </div>
    </main>
  );
}
