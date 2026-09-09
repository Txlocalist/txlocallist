"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ResultsSort from "@/components/ResultsSort/ResultsSort";
import { normalizeSort, sortResults } from "@/lib/results-sort";
import { getBlobImageUrl } from "@/lib/blob";

import styles from "./favorites.module.css";


function formatSavedDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

export function FavoritesDashboard({
  favorites,
  emptyTitle = "No saved businesses yet",
  emptyDescription = "Tap the bookmark on any listing to build your own shortlist of saved businesses.",
  emptyActionLabel = "Explore Businesses",
  statsLabel = "Saved Businesses",
}) {
  const [items, setItems] = useState(favorites);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.get("q") || "";
  const cityFilter = params.get("city") || "all";
  useEffect(() => { setItems(favorites); }, [favorites]);
  function updateFilters(changes) {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) => value && value !== "all" ? next.set(key, value) : next.delete(key));
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }
  const sortBy = normalizeSort(params.get("sort"));
  const [pendingBusinessId, setPendingBusinessId] = useState(null);
  const [error, setError] = useState("");

  const cityOptions = useMemo(
    () => [...new Set(items.map((item) => item.cityName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextItems = items.filter((item) => {
      const categoryText = item.categories.map((category) => category.name).join(" ").toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.cityName.toLowerCase().includes(normalizedQuery) ||
        categoryText.includes(normalizedQuery);

      const matchesCity = cityFilter === "all" || item.cityName === cityFilter;

      return matchesQuery && matchesCity;
    });

    return sortResults(nextItems, sortBy);
  }, [cityFilter, items, query, sortBy]);

  const savedCityCount = cityOptions.length;
  const latestSavedAt = items.reduce((latest, item) => Math.max(latest, new Date(item.createdAt).getTime() || 0), 0);
  const latestSave = latestSavedAt ? formatSavedDate(latestSavedAt) : "No saves yet";

  async function handleRemove(itemToRemove) {
    setError("");
    setPendingBusinessId(itemToRemove.businessId);
    setItems((current) => current.filter((item) => item.businessId !== itemToRemove.businessId));

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessId: itemToRemove.businessId }),
      });

      if (!response.ok) {
        throw new Error("Unable to remove saved business");
      }
    } catch {
      setItems((current) => [itemToRemove, ...current].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)));
      setError("We couldn't update your saved list just yet. Please try again.");
    } finally {
      setPendingBusinessId(null);
    }
  }

  if (items.length === 0) {
    return (
        <div className={styles.emptyState}>
        <h2 className={styles.emptyTitle}>{emptyTitle}</h2>
        <p className={styles.emptyDescription}>{emptyDescription}</p>
        <Link href="/results" className={styles.emptyAction}>
          {emptyActionLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>{statsLabel}</p>
          <p className={styles.statValue}>{items.length}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Cities Covered</p>
          <p className={styles.statValue}>{savedCityCount}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Latest Save</p>
          <p className={styles.statNote}>{latestSave}</p>
        </div>
      </section>

      <section className={styles.filterBar}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Search saved businesses</span>
          <input
            type="search"
            value={query}
            onChange={(event) => updateFilters({ q: event.target.value })}
            placeholder="Search by name, city, or category"
            className={styles.filterInput}
          />
        </label>

        <label className={styles.filterField}>
          <span className={styles.filterLabel}>City</span>
          <select
            value={cityFilter}
            onChange={(event) => updateFilters({ city: event.target.value })}
            className={styles.filterSelect}
          >
            <option value="all">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <ResultsSort saved />
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>No matches for those filters</h2>
          <p className={styles.emptyDescription}>
            Try a different city or clear your search to see everything you&apos;ve saved.
          </p>
          <button
            type="button"
            onClick={() => {
              updateFilters({ q: "", city: "" });
            }}
            className={styles.emptyButton}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <section className={styles.grid}>
          {filteredItems.map((item) => (
            <article key={item.businessId} className={styles.card}>
              <Link href={`/business/${item.businessSlug}`} className={styles.mediaLink}>
                {item.photoUrl ? (
                  <img src={getBlobImageUrl(item.photoUrl)} alt={item.photoAlt} className={styles.media} />
                ) : (
                  <div className={styles.mediaPlaceholder}>
                    <span className="material-icons" aria-hidden="true">
                      storefront
                    </span>
                  </div>
                )}
              </Link>

              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <div>
                    <p className={styles.savedMeta}>Saved {formatSavedDate(item.createdAt)}</p>
                    <h2 className={styles.cardTitle}>
                      <Link href={`/business/${item.businessSlug}`}>{item.name}</Link>
                    </h2>
                    <p className={styles.cardLocation}>{item.cityName}, TX</p>
                  </div>

                  <span className={styles.planBadge}>{item.planName}</span>
                </div>

                <p className={styles.cardDescription}>{item.description}</p>

                <div className={styles.categoryRow}>
                  {item.categories.slice(0, 3).map((category) => (
                    <Link
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      className={styles.categoryChip}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>

                <div className={styles.cardActions}>
                  <Link href={`/business/${item.businessSlug}`} className={styles.viewLink}>
                    View listing
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={pendingBusinessId === item.businessId}
                    className={styles.removeButton}
                  >
                    {pendingBusinessId === item.businessId ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
