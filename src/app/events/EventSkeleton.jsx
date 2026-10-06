import styles from "./loading.module.css";

function Bar({ className = "" }) {
  return <div className={`${styles.line} ${className}`} />;
}

function Copy() {
  return (
    <div className={styles.copy}>
      <Bar className={styles.short} />
      <Bar className={styles.title} />
      <Bar />
      <Bar className={styles.medium} />
    </div>
  );
}

function Cards({ results = false }) {
  return (
    <div className={results ? styles.resultCards : styles.grid}>
      {Array.from({ length: 4 }, (_, index) => (
        <article key={index} className={styles.card}>
          <div className={styles.cardMedia}>
            <div className={styles.image} />
            <div className={styles.ticket} />
          </div>
          <Copy />
        </article>
      ))}
    </div>
  );
}

export default function EventSkeleton({ variant = "landing" }) {
  const detail = variant === "detail";
  const results = variant === "results";
  return (
    <main className={`${styles.page} ${styles[variant]}`} aria-busy="true">
      <span
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-label={detail ? "Loading happening details" : "Loading happenings"}
      >
        {detail ? "Loading happening details" : "Loading local happenings"}
      </span>
      <div className={styles.frame} aria-hidden="true">
        {results ? (
          <aside className={styles.sidebar}>
            <Bar className={styles.logo} />
            {Array.from({ length: 6 }, (_, i) => (
              <Bar key={i} />
            ))}
          </aside>
        ) : null}
        <div className={styles.shell}>
          <div className={styles.header}>
            <Bar className={styles.logo} />
            <div className={styles.navigation}>
              <Bar />
              <Bar />
              <Bar />
            </div>
          </div>
          {detail ? (
            <>
              <Bar className={styles.back} />
              <div className={styles.detailHero}>
                <div className={styles.heroCopy}>
                  <Bar className={styles.short} />
                  <Bar className={styles.headline} />
                  <Bar className={styles.headline} />
                  <Bar className={styles.button} />
                </div>
                <div className={styles.image} />
              </div>
              <div className={styles.detailGrid}>
                <article className={styles.panel}>
                  <Copy />
                  <Copy />
                </article>
                <div className={styles.stack}>
                  <article className={styles.panel}>
                    <Copy />
                  </article>
                  <article className={styles.panel}>
                    <Copy />
                  </article>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.intro}>
                <Bar className={styles.headline} />
                {!results ? <Bar className={styles.headline} /> : null}
                <Bar className={styles.subtitle} />
                <div className={styles.search}>
                  <Bar />
                  <Bar />
                  <Bar className={styles.button} />
                </div>
                <div className={styles.chips}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Bar key={i} />
                  ))}
                </div>
              </div>
              <Bar className={styles.heading} />
              <div className={results ? styles.resultsGrid : undefined}>
                <Cards results={results} />
                {results ? (
                  <aside className={`${styles.panel} ${styles.planner}`}>
                    <Bar className={styles.title} />
                    <div className={styles.calendar}>
                      {Array.from({ length: 35 }, (_, i) => (
                        <Bar key={i} />
                      ))}
                    </div>
                    <Copy />
                  </aside>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
