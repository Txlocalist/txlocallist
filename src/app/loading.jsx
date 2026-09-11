import ResultsCardSkeleton from "./results/ResultsCardSkeleton";

// A shared streaming boundary lets navigation respond while server data loads.
export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", padding: "2rem clamp(1rem, 5vw, 5rem)" }} aria-busy="true">
      <p className="font-accent" role="status">Loading Texas Localist…</p>
      <ResultsCardSkeleton />
    </main>
  );
}
