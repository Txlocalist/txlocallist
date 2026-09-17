import styles from "./loading.module.css";

const cards = Array.from({ length: 4 }, (_, index) => index);

export default function EventsLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.shell} role="status" aria-live="polite" aria-label="Loading events">
        <span className={styles.status}>Loading local events</span>
        <div className={`${styles.line} ${styles.logo}`} />
        <div className={styles.search} />
        <div className={`${styles.line} ${styles.heading}`} />
        <div className={styles.grid} aria-hidden="true">
          {cards.map((card) => (
            <article key={card} className={styles.card} style={{ "--delay": `${card * 90}ms` }}>
              <div className={styles.ticket} />
              <div className={styles.image} />
              <div className={styles.copy}>
                <div className={`${styles.line} ${styles.short}`} />
                <div className={`${styles.line} ${styles.title}`} />
                <div className={styles.line} />
                <div className={`${styles.line} ${styles.medium}`} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
