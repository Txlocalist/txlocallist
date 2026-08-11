const skeletonCards = [
  { titleWidth: "68%", lineWidth: "92%" },
  { titleWidth: "82%", lineWidth: "76%" },
  { titleWidth: "61%", lineWidth: "86%" },
  { titleWidth: "74%", lineWidth: "81%" },
  { titleWidth: "88%", lineWidth: "70%" },
  { titleWidth: "65%", lineWidth: "89%" },
];

export default function ResultsCardSkeleton() {
  return (
    <div
      className="results-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading businesses"
    >
      <span className="results-skeleton-status">Loading businesses…</span>
      <div className="grid-container results-skeleton-grid" aria-hidden="true">
        {skeletonCards.map((card, index) => (
          <article
            key={index}
            className="gem-card results-skeleton-card"
            style={{ "--skeleton-delay": `${index * 85}ms` }}
          >
            <div className="results-skeleton-shape results-skeleton-image" />
            <div className="results-skeleton-shape results-skeleton-badge" />

            <div
              className="results-skeleton-shape results-skeleton-title"
              style={{ width: card.titleWidth }}
            />
            <div className="results-skeleton-copy">
              <div className="results-skeleton-shape results-skeleton-line" />
              <div
                className="results-skeleton-shape results-skeleton-line"
                style={{ width: card.lineWidth }}
              />
            </div>

            <div className="results-skeleton-footer">
              <div className="results-skeleton-actions">
                <div className="results-skeleton-shape results-skeleton-action" />
                <div className="results-skeleton-shape results-skeleton-action" />
              </div>
              <div className="results-skeleton-shape results-skeleton-arrow" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
