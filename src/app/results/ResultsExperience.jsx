"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import logoImage from "@/app/assets/Tx-Localist-01.png";
import { LikeCount } from "@/components/LikeCount";
import SearchBar from "@/components/SearchBar";
import { getBlobImageUrl } from "@/lib/blob";
import { formatEventDateRange } from "@/lib/event-dates";

import {
  ArrowRightIcon,
  CameraIcon,
  PlusCircleIcon,
  ShareIcon,
} from "./icons";
import ResultsSort from "@/components/ResultsSort/ResultsSort";
import { normalizeSort, sortResults } from "@/lib/results-sort";
import ResultsCardSkeleton from "./ResultsCardSkeleton";

const INITIAL_RECENT_BUSINESS_LIMIT = 15;
const EMPTY_ITEMS = [];
const numberFormatter = new Intl.NumberFormat("en-US");

function eventDateLabel(event) {
  if (!event.startDate) return "EVENT";
  return formatEventDateRange(
    event.startDate,
    event.endDate,
    event.timezone,
    { compact: true }
  );
}

/* ─── Card views ──────────────────────────────────────────── */
function BusinessEngagement({ biz, saved, count, saving, onSave, isLoggedIn, list = false }) {
  const numericSaveCount = Number(count);
  const saveCount = Number.isFinite(numericSaveCount)
    ? Math.max(0, Math.trunc(numericSaveCount))
    : 0;
  const formattedSaveCount = numberFormatter.format(saveCount);
  const saveLabel = saving
    ? `Updating saved status for ${biz.name}. ${formattedSaveCount} ${saveCount === 1 ? "save" : "saves"}.`
    : saved
      ? `Remove ${biz.name} from saved businesses. ${formattedSaveCount} ${saveCount === 1 ? "save" : "saves"}.`
      : `Save ${biz.name} to saved businesses. ${formattedSaveCount} ${saveCount === 1 ? "save" : "saves"}.`;

  return (
    <div className={"business-engagement" + (list ? " business-engagement-list" : "")}>
      <div className="business-action">
        <LikeCount
          count={biz.likesCount ?? 0}
          size="sm"
          targetType="business"
          targetId={biz.id}
          targetName={biz.name}
          initialLiked={Boolean(biz.isLiked)}
          isLoggedIn={isLoggedIn}
          className="business-like-btn"
        />
        <span className="business-action-label" aria-hidden="true">Like</span>
      </div>
      <div className="business-action">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-busy={saving}
          aria-pressed={saved}
          aria-label={saveLabel}
          className={[
            "save-btn font-accent",
            saved ? "save-btn-saved" : "",
            saving ? "save-btn-animating" : "",
          ].filter(Boolean).join(" ")}
        >
          <span className="material-icons save-btn-icon" aria-hidden="true">
            {saved ? "bookmark" : "bookmark_border"}
          </span>
          <span className="save-btn-count" aria-hidden="true">{formattedSaveCount}</span>
        </button>
        <span className="business-action-label" aria-hidden="true">Save</span>
      </div>
    </div>
  );
}

function BusinessCard({ biz, saved, count, saving, onSave, isLoggedIn }) {
  const businessHref = "/business/" + biz.slug;

  return (
    <article className="gem-card card-stack-effect">
      {biz.image?.url && biz.image.url !== "/placeholder.jpg" ? (
        <Link href={businessHref} className="gem-image-wrapper gem-image-link" aria-label={`View ${biz.name}`}>
          <img src={getBlobImageUrl(biz.image.url)} alt={biz.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Link>
      ) : (
        <div className="gem-image-wrapper gem-image-placeholder" aria-hidden="true">
          <span className="material-icons">storefront</span>
        </div>
      )}
      <div className="category-tag">{biz.city?.name ?? biz.city}</div>
      {biz.activeJobCount > 0 && (
        <div className="hiring-tag">
          <span className="material-icons" aria-hidden="true">work</span>
          {biz.activeJobCount} {biz.activeJobCount === 1 ? "job" : "jobs"}
        </div>
      )}
      <h4 className="gem-name">{biz.name}</h4>
      <p className="gem-desc">{biz.description || ""}</p>
      <div className="gem-footer">
        <BusinessEngagement
          biz={biz}
          saved={saved}
          count={count}
          saving={saving}
          onSave={onSave}
          isLoggedIn={isLoggedIn}
        />
        <Link href={businessHref} className="gem-action-btn">
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </article>
  );
}

function EventCard({ event, isLoggedIn }) {
  const eventHref = `/events/${event.id}`;

  return (
    <article className="gem-card card-stack-effect">
      {event.imageUrl && (
        <Link href={eventHref} className="gem-image-wrapper gem-image-link" aria-label={`View ${event.title}`}>
          <img src={getBlobImageUrl(event.imageUrl)} alt={event.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Link>
      )}
      <div className="category-tag bg-retro-red text-white">
        {eventDateLabel(event)}
      </div>
      <h4 className="gem-name">{event.title}</h4>
      <p className="gem-desc">
        {event.description?.slice(0, 100)}{event.description?.length > 100 ? "..." : ""}
      </p>
      <p className="gem-address" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
        {event.addressName || event.address} &middot; {event.city}
      </p>
      <div className="gem-footer">
        <LikeCount
          count={event.likesCount ?? 0}
          size="sm"
          targetType="event"
          targetId={event.id}
          targetName={event.title}
          initialLiked={Boolean(event.isLiked)}
          isLoggedIn={isLoggedIn}
        />
        <Link href={eventHref} className="gem-action-btn"><ArrowRightIcon size={16} /></Link>
      </div>
    </article>
  );
}

/* ─── List-row views ──────────────────────────────────────── */
function BusinessRow({ biz, saved, count, saving, onSave, isLoggedIn }) {
  return (
    <article className="list-item">
      <div className="list-item-thumb">
        {biz.image?.url && biz.image.url !== "/placeholder.jpg"
          ? <img src={getBlobImageUrl(biz.image.url)} alt={biz.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span className="material-icons list-item-thumb-icon">storefront</span>
        }
      </div>
      <div className="list-item-body">
        <div className="list-item-meta">
          <span className="font-accent list-item-city">{biz.city?.name ?? biz.city}</span>
          {biz.categories?.[0]?.name && (
            <span className="font-accent list-item-cat">{biz.categories[0].name.toUpperCase()}</span>
          )}
          {biz.activeJobCount > 0 && (
            <span className="font-accent list-item-hiring">
              HIRING {biz.activeJobCount} {biz.activeJobCount === 1 ? "ROLE" : "ROLES"}
            </span>
          )}
        </div>
        <h4 className="list-item-name">{biz.name}</h4>
        <p className="list-item-desc">
          {biz.description?.slice(0, 160)}{biz.description?.length > 160 ? "..." : ""}
        </p>
        <BusinessEngagement
          biz={biz}
          saved={saved}
          count={count}
          saving={saving}
          onSave={onSave}
          isLoggedIn={isLoggedIn}
          list
        />
      </div>
      <Link href={"/business/" + biz.slug} className="gem-action-btn list-item-arrow">
        <ArrowRightIcon size={16} />
      </Link>
    </article>
  );
}

function EventRow({ event, isLoggedIn }) {
  return (
    <article className="list-item">
      <div className="list-item-thumb list-item-thumb-event">
        {event.imageUrl
          ? <img src={getBlobImageUrl(event.imageUrl)} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span className="material-icons list-item-thumb-icon">event</span>
        }
      </div>
      <div className="list-item-body">
        <div className="list-item-meta">
          <span className="font-accent list-item-city list-item-city-event">
            {eventDateLabel(event)}
          </span>
          <span className="font-accent list-item-cat">{event.city}</span>
        </div>
        <h4 className="list-item-name">{event.title}</h4>
        <p className="list-item-desc">
          {event.description?.slice(0, 160)}{event.description?.length > 160 ? "..." : ""}
        </p>
        <LikeCount
          count={event.likesCount ?? 0}
          size="sm"
          targetType="event"
          targetId={event.id}
          targetName={event.title}
          initialLiked={Boolean(event.isLiked)}
          isLoggedIn={isLoggedIn}
        />
      </div>
      <Link href={`/events/${event.id}`} className="gem-action-btn list-item-arrow">
        <ArrowRightIcon size={16} />
      </Link>
    </article>
  );
}

function FilterChip({ label, onRemove, tone = "default" }) {
  return (
    <span className={"active-filter-chip active-filter-chip-" + tone}>
      <span>{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="active-filter-chip-close"
          aria-label={"Remove " + label}
        >
          <span className="material-icons">close</span>
        </button>
      ) : null}
    </span>
  );
}

function EmptyResultsState({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  primaryAction,
  secondaryLabel,
  secondaryHref,
  secondaryAction,
}) {
  return (
    <div className="results-empty-state card-stack-effect">
      <p className="font-accent results-empty-eyebrow">{eyebrow}</p>
      <h3 className="results-empty-title">{title}</h3>
      <p className="results-empty-description">{description}</p>

      <div className="results-empty-actions">
        {primaryHref ? (
          <Link href={primaryHref} className="results-empty-primary">
            {primaryLabel}
          </Link>
        ) : (
          <button type="button" onClick={primaryAction} className="results-empty-primary">
            {primaryLabel}
          </button>
        )}

        {secondaryLabel ? (
          secondaryHref ? (
            <Link href={secondaryHref} className="results-empty-secondary">
              {secondaryLabel}
            </Link>
          ) : (
            <button type="button" onClick={secondaryAction} className="results-empty-secondary">
              {secondaryLabel}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function ResultsExperience({
  initialQuery = "",
  initialLocation = "",
  initialCategory = "",
  initialBrowseAll = false,
  initialJobsOnly = false,
  user = null,
  dashboardPath = null,
  savedIds = EMPTY_ITEMS,
  initialFavoriteBusinesses = EMPTY_ITEMS,
  availableCategories = [],
  availableCities = [],
}) {
  const router    = useRouter();
  const urlParams = useSearchParams();

  const [activeTab,   setActiveTab]   = useState(urlParams.get("tab") === "events" ? "events" : "businesses");
  const [isSearching, setIsSearching] = useState(false);
  const [businesses,  setBusinesses]  = useState([]);
  const [events,      setEvents]      = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearch,  setLastSearch]  = useState({ q: initialQuery, loc: initialLocation });
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [viewMode,         setViewMode]         = useState("card"); // "card" | "list"
  const [showCities,       setShowCities]       = useState(false);
  const [showCategories,   setShowCategories]   = useState(false);
  const [showMobileCities, setShowMobileCities] = useState(false);
  const [activeSort,       setActiveSort]       = useState(normalizeSort(urlParams.get("sort"), activeTab === "events" ? "upcoming" : "newest", ["popular", "upcoming"])); // "" | "popular"
  const [activeBrowseTab,  setActiveBrowseTab]  = useState(
    initialJobsOnly ? "jobs" : initialBrowseAll ? "all" : initialQuery || initialLocation ? "search" : ""
  );
  const [jobsOnly, setJobsOnly] = useState(initialJobsOnly);
  const [favoriteBusinesses, setFavoriteBusinesses] = useState(initialFavoriteBusinesses);

  // Saved state: tracks { [businessId]: { saved, count } } for optimistic UI
  const [savedMap, setSavedMap] = useState(() =>
    Object.fromEntries(savedIds.map((id) => [id, { saved: true }]))
  );
  const [savingIds, setSavingIds] = useState(() => new Set());

  const requestVersion = useRef(0);
  const [pagination, setPagination] = useState({ businesses: {}, events: {} });

  const currentYear = new Date().getFullYear();
  function replaceResultsUrl({
    query = urlParams.get("q") || "",
    location = urlParams.get("loc") || "",
    category = urlParams.get("category") || "",
    type = urlParams.get("tab") === "events" ? "events" : "businesses",
    jobs = urlParams.get("jobs") === "1",
    browse = urlParams.get("browse") || "",
    sort = activeSort,
    page = 1,
  }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("loc", location);
    if (category) params.set("category", category);
    if (type && type !== "businesses") params.set("tab", type);
    if (jobs) params.set("jobs", "1");
    if (["all", "popular", "favorites"].includes(browse)) params.set("browse", browse);
    const extras = type === "events" ? ["upcoming"] : browse === "favorites" ? [] : ["popular"];
    params.set("sort", normalizeSort(sort, type === "events" ? "upcoming" : browse === "popular" ? "popular" : "newest", extras));
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    router.push(queryString ? "/results?" + queryString : "/results", { scroll: false });
  }

  useEffect(() => {
    const urlTab = urlParams.get("tab") === "events" ? "events" : "businesses";
    setActiveTab((current) => (current === urlTab ? current : urlTab));
  }, [urlParams]);

  useEffect(() => {
    const q = urlParams.get("q") || "";
    const loc = urlParams.get("loc") || "";
    const category = urlParams.get("category") || "";
    const jobs = urlParams.get("jobs") === "1";
    const browse = urlParams.get("browse");
    const mode = ["favorites", "popular", "all"].includes(browse) ? browse : jobs ? "jobs" : q || loc || category ? "search" : "new";
    const type = urlParams.get("tab") === "events" ? "events" : "businesses";
    const extras = type === "events" ? ["upcoming"] : mode === "favorites" ? [] : ["popular"];
    const sort = normalizeSort(urlParams.get("sort"), type === "events" ? "upcoming" : mode === "popular" ? "popular" : "newest", extras);
    runSearch(q, loc, sort, mode, jobs, mode === "new" ? INITIAL_RECENT_BUSINESS_LIMIT : undefined, category, Math.max(1, parseInt(urlParams.get("page"), 10) || 1));
    return () => { requestVersion.current += 1; };
    // URL is the source of truth for refresh and browser navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams]);

  useEffect(() => {
    setFavoriteBusinesses(initialFavoriteBusinesses);
    setSavedMap(Object.fromEntries(savedIds.map((id) => [id, { saved: true }])));
  }, [initialFavoriteBusinesses, savedIds]);

  function syncFavoriteBusinesses(biz, shouldBeSaved, count) {
    setFavoriteBusinesses((prev) => {
      const existing = prev.find((item) => item.id === biz.id);

      if (!shouldBeSaved) {
        return prev.filter((item) => item.id !== biz.id);
      }

      const nextItem = {
        ...biz,
        favoritesCount: count,
        savedAt: existing?.savedAt ?? new Date().toISOString(),
      };

      if (existing) {
        return prev.map((item) => (item.id === biz.id ? nextItem : item));
      }

      return [nextItem, ...prev];
    });
  }

  async function runSearch(
    q,
    loc,
    sort = "",
    browseTab = "search",
    nextJobsOnly = false,
    limit,
    category = "",
    page = 1
  ) {
    const version = ++requestVersion.current;
    sort = normalizeSort(sort || activeSort, "newest", ["popular", "upcoming"]);
    setIsSearching(true);
    setHasSearched(true);
    setLastSearch({ q, loc });
    setSelectedCategory(category);
    setActiveSort(sort);
    setActiveBrowseTab(browseTab);
    setJobsOnly(nextJobsOnly);

    if (browseTab === "favorites") { setIsSearching(false); return; }
    const bizP = new URLSearchParams();
    bizP.set("page", String(page));
    if (q)    bizP.set("q",    q);
    if (loc)  bizP.set("loc",  loc);
    if (sort) bizP.set("sort", sort);
    if (nextJobsOnly) bizP.set("jobs", "1");
    if (limit) bizP.set("limit", String(limit));
    if (category) bizP.set("category", category);

    const evtP = new URLSearchParams();
    if (loc) evtP.set("city", loc);
    if (q) evtP.set("q", q);
    evtP.set("sort", sort === "popular" ? "newest" : sort);
    evtP.set("page", String(page));
    evtP.set("limit", "12");

    try {
      const [bizRes, evtRes] = await Promise.all([
        fetch("/api/search?" + bizP).then((r) => r.json()),
        fetch("/api/events?" + evtP).then((r) => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      ]);
      if (version !== requestVersion.current) return;
      setPagination({ businesses: bizRes?.data ?? {}, events: evtRes ?? {} });
      const bizList = bizRes?.data?.results ?? [];
      const evtList = evtRes?.events ?? [];
      setBusinesses(bizList);
      setEvents(evtList);
    } catch (_) {
      if (version !== requestVersion.current) return;
      setBusinesses([]);
      setEvents([]);
    } finally {
      if (version === requestVersion.current) setIsSearching(false);
    }
  }

  function handleSearchBarSubmit({ query, location, type }) {
    setActiveTab(type);
    const preserveJobs = type === "businesses" && jobsOnly;
    replaceResultsUrl({ query, location, type, jobs: preserveJobs });

  }

  function clearSearch() {
    setActiveTab("businesses");
    setViewMode("card");
    replaceResultsUrl({ query: "", location: "", category: "", type: "businesses", jobs: false, browse: "", sort: "newest" });

  }

  function openNewListings() {
    setActiveTab("businesses");
    setViewMode("card");
    setJobsOnly(false);
    replaceResultsUrl({ query: "", location: "", category: "", type: "businesses", jobs: false, browse: "", sort: "newest" });

  }

  function openMostSaved() {
    setActiveTab("businesses");
    setViewMode("card");
    setJobsOnly(false);
    replaceResultsUrl({ query: "", location: lastSearch.loc, category: "", type: "businesses", jobs: false, browse: "popular", sort: "popular" });

  }

  function openFavorites() {
    if (!user) {
      router.push("/login?next=/results");
      return;
    }

    setActiveTab("businesses");
    setViewMode("card");
    setActiveSort("newest");
    setJobsOnly(false);
    setActiveBrowseTab("favorites");
    setHasSearched(true);
    replaceResultsUrl({ query: "", location: "", category: "", type: "businesses", jobs: false, browse: "favorites", sort: "newest" });
  }

  function removeQueryFilter() { replaceResultsUrl({ query: "" }); }
  function removeLocationFilter() { replaceResultsUrl({ location: "" }); }
  function removeCategoryFilter() { replaceResultsUrl({ category: "" }); }
  function removeBrowseFilter() { replaceResultsUrl({ browse: "all" }); }
  function removeEventsFilter() { replaceResultsUrl({ type: "businesses" }); }
  function removeJobsFilter() { replaceResultsUrl({ jobs: false }); }

  async function toggleSave(biz) {
    if (!user) {
      router.push("/login?next=/results");
      return;
    }
    if (savingIds.has(biz.id)) return;

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(biz.id);
      return next;
    });

    // Optimistic update
    const current = savedMap[biz.id];
    const wasSaved = current?.saved ?? false;
    const oldCount = current?.count ?? biz.favoritesCount ?? 0;
    const optimisticSaved = !wasSaved;
    const optimisticCount = wasSaved ? Math.max(0, oldCount - 1) : oldCount + 1;
    setSavedMap((prev) => ({
      ...prev,
      [biz.id]: { saved: optimisticSaved, count: optimisticCount },
    }));
    syncFavoriteBusinesses(biz, optimisticSaved, optimisticCount);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: biz.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedMap((prev) => ({ ...prev, [biz.id]: { saved: data.saved, count: data.count } }));
        syncFavoriteBusinesses(biz, data.saved, data.count);
      } else {
        // Revert on failure
        setSavedMap((prev) => ({ ...prev, [biz.id]: { saved: wasSaved, count: oldCount } }));
        syncFavoriteBusinesses(biz, wasSaved, oldCount);
      }
    } catch {
      setSavedMap((prev) => ({ ...prev, [biz.id]: { saved: wasSaved, count: oldCount } }));
      syncFavoriteBusinesses(biz, wasSaved, oldCount);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(biz.id);
        return next;
      });
    }
  }

  function getSaveState(biz) {
    const override = savedMap[biz.id];
    return {
      saved: override?.saved ?? false,
      count: override?.count ?? biz.favoritesCount ?? 0,
    };
  }

  const visibleFavoriteBusinesses = sortResults(favoriteBusinesses.filter((item) => {
        const text = [item.name, item.description, ...(item.tags || []).map((tag) => tag.name)].join(" ").toLowerCase();
        const city = (item.city?.name || item.city || "").toLowerCase();
        const location = lastSearch.loc.replace(/,?\s+(?:TX|Texas)$/i, "").trim().toLowerCase();
        return (!lastSearch.q || text.includes(lastSearch.q.toLowerCase())) &&
          (!location || city.includes(location) || item.city?.slug === location) &&
          (!selectedCategory || item.categories?.some((category) => category.slug === selectedCategory)) &&
          (!jobsOnly || item.activeJobCount > 0);
      }), activeSort, { date: (item) => item.savedAt });

  const activeFilterChips = [];

  if (hasSearched) {
    activeFilterChips.push({
      key: "tab",
      label: activeTab === "events" ? "Local Events" : "Local Businesses",
      tone: activeTab === "events" ? "events" : "businesses",
    });
  }

  if (hasSearched && activeBrowseTab === "new") {
    activeFilterChips.push({
      key: "new",
      label: activeSort === "newest" ? "New" : "All Businesses",
      tone: "new",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && activeBrowseTab === "popular") {
    activeFilterChips.push({
      key: "popular",
      label: activeSort === "popular" ? "Most Saved" : "All Businesses",
      tone: "popular",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && activeBrowseTab === "favorites") {
    activeFilterChips.push({
      key: "favorites",
      label: "Saved Businesses",
      tone: "favorites",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && jobsOnly) {
    activeFilterChips.push({
      key: "jobs",
      label: "Hiring Now",
      tone: "jobs",
      onRemove: removeJobsFilter,
    });
  }

  if (hasSearched && lastSearch.q) {
    activeFilterChips.push({
      key: "query",
      label: `Query: ${lastSearch.q}`,
      tone: "default",
      onRemove: removeQueryFilter,
    });
  }

  if (hasSearched && selectedCategory) {
    const categoryName = availableCategories.find(
      (category) => category.slug === selectedCategory
    )?.name;

    activeFilterChips.push({
      key: "category",
      label: `Category: ${categoryName || selectedCategory}`,
      tone: "default",
      onRemove: removeCategoryFilter,
    });
  }

  if (hasSearched && lastSearch.loc) {
    activeFilterChips.push({
      key: "location",
      label: `Near ${lastSearch.loc}`,
      tone: "location",
      onRemove: removeLocationFilter,
    });
  }

  /* Results panel (tab + view-mode aware) */
  function ResultsPanel() {
    if (isSearching) {
      return <ResultsCardSkeleton />;
    }

    /* ── Business results ── */
    if (activeTab === "businesses") {
      const visibleBusinesses = activeBrowseTab === "favorites" ? visibleFavoriteBusinesses : businesses;

      if (visibleBusinesses.length === 0) {
        return activeBrowseTab === "favorites"
          ? (
              <EmptyResultsState
                eyebrow="Saved list"
                title="Your saved businesses list is still empty."
                description="Tap the bookmark on any listing and it will land here for quick revisits."
                primaryLabel="Explore Businesses"
                primaryAction={clearSearch}
              />
            )
          : (
              <EmptyResultsState
                eyebrow="No matches"
                title="Nothing matched that search."
                description="Try broadening your search or removing a filter chip."
                primaryLabel="Clear Filters"
                primaryAction={clearSearch}
              />
            );
      }

      return viewMode === "list"
          ? <div className="list-container">{visibleBusinesses.map((b) => {
            const { saved, count } = getSaveState(b);
            return (
              <BusinessRow
                key={b.id}
                biz={b}
                saved={saved}
                count={count}
                saving={savingIds.has(b.id)}
                onSave={() => toggleSave(b)}
                isLoggedIn={Boolean(user)}
              />
            );
          })}</div>
        : <div className="grid-container">{visibleBusinesses.map((b) => {
            const { saved, count } = getSaveState(b);
            return (
              <BusinessCard
                key={b.id}
                biz={b}
                saved={saved}
                count={count}
                saving={savingIds.has(b.id)}
                onSave={() => toggleSave(b)}
                isLoggedIn={Boolean(user)}
              />
            );
          })}</div>;
    }

    /* ── Event results ── */
    if (events.length === 0) {
      return (
        <EmptyResultsState
          eyebrow="No events"
          title={`No events found near ${lastSearch.loc || lastSearch.q || "this area"}.`}
          description="Try broadening your search or removing a filter to see more events."
          primaryLabel="Clear Filters"
          primaryAction={clearSearch}
        />
      );
    }
    return viewMode === "list"
      ? <div className="list-container">{events.map((e) => <EventRow key={e.id} event={e} isLoggedIn={Boolean(user)} />)}</div>
      : <div className="grid-container">{events.map((e) => <EventCard key={e.id} event={e} isLoggedIn={Boolean(user)} />)}</div>;
  }

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-content">
          <Link href="/" aria-label="Texas Localist home">
            <Image src={logoImage} alt="Texas Localist" width={220} height={140}
              sizes="220px" className="logo-image" priority />
          </Link>
          <nav className="sidebar-nav">
            {/* Events */}
            <Link href="/events" className="font-accent nav-link">
              <div className="nav-icon-wrapper">
                <span className="material-icons" style={{ fontSize: "1.2rem", color: "white" }}>event</span>
              </div>
              EVENTS
            </Link>

            {/* Cities dropdown */}
            <div className="nav-cities-wrap">
              <button
                type="button"
                onClick={() => setShowCities((v) => !v)}
                className={"font-accent nav-link nav-link-btn" + (showCities ? " nav-link-open" : "")}
              >
                <div className="nav-icon-wrapper">
                  <span className="material-icons" style={{ fontSize: "1.2rem", color: "white" }}>location_city</span>
                </div>
                CITIES
                <span className={"material-icons nav-chevron" + (showCities ? " nav-chevron-open" : "")}>
                  expand_more
                </span>
              </button>
              {showCities && (
                <div className="cities-dropdown">
                  {availableCities.length > 0 ? (
                    availableCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        className="font-accent city-option"
                        onClick={() => {
                          setShowCities(false);
                          replaceResultsUrl({ location: city, type: activeTab });

                        }}
                      >
                        <span className="material-icons city-option-pin">place</span>
                        {city}
                      </button>
                    ))
                  ) : (
                    <div className="font-accent city-option" aria-disabled>
                      No cities available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Categories dropdown */}
            <div className="nav-cities-wrap">
              <button
                type="button"
                onClick={() => setShowCategories((v) => !v)}
                className={"font-accent nav-link nav-link-btn" + (showCategories ? " nav-link-open" : "")}
              >
                <div className="nav-icon-wrapper">
                  <span className="material-icons" style={{ fontSize: "1.2rem", color: "white" }}>category</span>
                </div>
                CATEGORIES
                <span className={"material-icons nav-chevron" + (showCategories ? " nav-chevron-open" : "")}>
                  expand_more
                </span>
              </button>
              {showCategories && (
                <div className="cities-dropdown">
                  {availableCategories.length > 0 ? (
                    availableCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className="font-accent city-option"
                        onClick={() => {
                          setShowCategories(false);
                          setActiveTab("businesses");
                          replaceResultsUrl({
                            location: lastSearch.loc,
                            category: category.slug,
                            type: "businesses",
                          });

                        }}
                      >
                        <span className="material-icons city-option-pin">sell</span>
                        {category.name}
                      </button>
                    ))
                  ) : (
                    <div className="font-accent city-option" aria-disabled>
                      No categories available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add listing */}
            <Link href="/post-your-business" className="font-accent nav-link">
              <div className="nav-icon-wrapper"><PlusCircleIcon size={20} style={{ color: "white" }} /></div>
              ADD LISTING
            </Link>

            <Link
              href={user ? dashboardPath : "/login"}
              className={"card-stack-effect font-accent nav-link login-btn" + (user ? " login-btn-dashboard" : "")}
            >
              {user ? "DASHBOARD" : "LOGIN"}
            </Link>

            <div className="sidebar-browse-tabs">
              <button
                type="button"
                className={"font-accent sidebar-browse-tab" + (activeBrowseTab === "new" ? " sidebar-browse-tab-active" : "")}
                onClick={openNewListings}
              >
                <span className="sidebar-browse-icon sidebar-browse-icon-new">
                  <span className="material-icons">fiber_new</span>
                </span>
                <span className="sidebar-browse-label">NEW</span>
              </button>

              <button
                type="button"
                className={"font-accent sidebar-browse-tab" + (activeBrowseTab === "popular" ? " sidebar-browse-tab-active" : "")}
                onClick={openMostSaved}
              >
                <span className="sidebar-browse-icon sidebar-browse-icon-popular">
                  <span className="material-icons">whatshot</span>
                </span>
                <span className="sidebar-browse-label">MOST SAVED</span>
              </button>

              <button
                type="button"
                className={"font-accent sidebar-browse-tab" + (activeBrowseTab === "favorites" ? " sidebar-browse-tab-active" : "")}
                onClick={openFavorites}
              >
                <span className="sidebar-browse-icon sidebar-browse-icon-favorites">
                  <span className="material-icons">bookmark</span>
                </span>
                <span className="sidebar-browse-label">SAVED BUSINESSES</span>
              </button>
            </div>
          </nav>
        </div>
        <div className="sidebar-footer">
          &copy; {currentYear} TEXAS LOCALIST.<br />HANDCRAFTED IN THE LONE STAR STATE.
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content grainy-overlay">
        {/* Search header — full-width search bar */}
        <header className="search-header">
          <div className="search-bar-container">
            <div className="mobile-logo-wrap">
              <Link href="/" aria-label="Texas Localist home">
                <Image src={logoImage} alt="Texas Localist" width={260} height={160}
                  sizes="(max-width: 768px) 220px, 260px" className="mobile-logo-image" priority />
              </Link>
            </div>
            <SearchBar
              action="/results"
              initialQuery={lastSearch.q}
              initialLocation={lastSearch.loc}
              defaultLocation={
                activeBrowseTab === "favorites" || activeBrowseTab === "all" || jobsOnly
                  ? ""
                  : "Austin, TX"
              }
              initialType={activeTab}
              visibleTypes={["businesses"]}
              showTypeSelector={false}
              variant="inline"
              onSubmit={handleSearchBarSubmit}
            />
          </div>
        </header>

        <div className="content-wrapper">
          {/* ── Post-search results ── */}
          {hasSearched && (
            <section className="results-section">
              <div className="results-header">
                {/* Left: result count */}
                <span className="font-accent results-count">
                  {isSearching ? "SEARCHING..." : (
                    activeTab === "businesses"
                      ? `${
                          activeBrowseTab === "favorites"
                            ? visibleFavoriteBusinesses.length
                            : businesses.length
                        } ${
                          (activeBrowseTab === "favorites" ? visibleFavoriteBusinesses.length : businesses.length) !== 1
                            ? "BUSINESSES"
                            : "BUSINESS"
                        }${
                          jobsOnly
                            ? " · HIRING NOW"
                            : activeBrowseTab === "favorites"
                            ? " · SAVED BUSINESSES"
                            : activeSort === "popular"
                              ? " · MOST SAVED"
                              : activeBrowseTab === "new"
                                ? " · NEW"
                                : ""
                        }`
                      : `${events.length} EVENT${events.length !== 1 ? "S" : ""}`
                  )}
                </span>

                {/* Right: view toggle + clear */}
                <div className="results-header-right">
                  <ResultsSort value={activeSort} events={activeTab === "events"} popular={activeTab === "businesses" && activeBrowseTab !== "favorites"} saved={activeBrowseTab === "favorites"} onChange={(sort) => replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, category: selectedCategory, type: activeTab, jobs: jobsOnly, browse: activeBrowseTab, sort })} />
                  {activeBrowseTab !== "favorites" && <div className="results-pages" role="group" aria-label="Results pages">
                    <button type="button" disabled={isSearching || !(pagination[activeTab]?.page > 1)} onClick={() => replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, category: selectedCategory, type: activeTab, jobs: jobsOnly, browse: activeBrowseTab, page: pagination[activeTab].page - 1 })}>Previous</button>
                    <span aria-live="polite"> Page {pagination[activeTab]?.page || 1} </span>
                    <button type="button" disabled={isSearching || !pagination[activeTab]?.hasMore} onClick={() => replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, category: selectedCategory, type: activeTab, jobs: jobsOnly, browse: activeBrowseTab, page: (pagination[activeTab]?.page || 1) + 1 })}>Next</button>
                  </div>}
                  <div className="view-toggle" role="group" aria-label="View mode">
                    {[
                      { mode: "card", icon: "grid_view",  label: "Card view" },
                      { mode: "list", icon: "view_list",  label: "List view" },
                    ].map(({ mode, icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        aria-label={label}
                        onClick={() => setViewMode(mode)}
                        className={"view-toggle-btn font-accent" + (viewMode === mode ? " view-toggle-active" : "")}
                      >
                        <span className="material-icons" style={{ fontSize: "1.1rem" }}>{icon}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={clearSearch} className="font-accent clear-btn">
                    CLEAR
                  </button>
                </div>
              </div>

              {activeFilterChips.length > 0 && (
                <div className="active-filter-row" aria-label="Active filters">
                  {activeFilterChips.map((chip) => (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      tone={chip.tone}
                      onRemove={chip.onRemove}
                    />
                  ))}
                </div>
              )}

              <ResultsPanel />

              <div className="results-trust-strip card-stack-effect">
                <div className="results-trust-copy">
                  <p className="font-accent results-trust-eyebrow">TX Localist Promise</p>
                  <h3 className="results-trust-title">No ads. No sponsored placements. Just local.</h3>
                  <p className="results-trust-description">
                    Own a local business? Add your listing and help neighbors find you.
                  </p>
                </div>
                <div className="results-trust-actions">
                  <Link href="/post-your-business" className="results-trust-primary">
                    Add Your Listing
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section className="promo-banner">
            <div className="banner-bg"><div className="banner-gradient"></div></div>
            <div className="banner-content">
              <h3 className="text-shadow-retro banner-title">Skip the <span className="text-retro-yellow">Noise.</span></h3>
              <p className="font-accent banner-subtitle">No ads. No nonsense. Just local.</p>
              <Link href="/post-your-business" className="card-stack-effect font-accent banner-btn">ADD YOUR BUSINESS</Link>
            </div>
          </section>
        </div>

        <footer className="app-footer">
          <div className="font-accent footer-links">
            <Link href="/">HOME</Link>
            <Link href="/events">EVENTS</Link>
            <Link href="/login">LOGIN</Link>
          </div>
          <div className="footer-social">
            <a href="https://www.google.com/maps/search/?api=1&query=Texas+local+gems"
              target="_blank" rel="noopener noreferrer" className="social-link">
              <ShareIcon size={16} />
            </a>
            <Link href="/results" className="social-link"><CameraIcon size={16} /></Link>
          </div>
        </footer>
      </main>

      {/* ── Mobile bottom nav (hidden on desktop) ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link href="/events" className="font-accent mobile-nav-item">
          <span className="material-icons">event</span>
          <span>EVENTS</span>
        </Link>
        <button
          type="button"
          className="font-accent mobile-nav-item"
          onClick={() => setShowMobileCities(true)}
        >
          <span className="material-icons">location_city</span>
          <span>CITIES</span>
        </button>
        <button
          type="button"
          className="font-accent mobile-nav-item"
          onClick={openNewListings}
        >
          <span className="material-icons">fiber_new</span>
          <span>NEW</span>
        </button>
        <Link
          href={user ? dashboardPath : "/login"}
          className={"font-accent mobile-nav-item" + (user ? " mobile-nav-dashboard" : "")}
        >
          <span className="material-icons">{user ? "dashboard" : "login"}</span>
          <span>{user ? "DASHBOARD" : "LOGIN"}</span>
        </Link>
      </nav>

      {/* ── Mobile city picker sheet ── */}
      {showMobileCities && (
        <div className="mobile-city-overlay" onClick={() => setShowMobileCities(false)}>
          <div className="mobile-city-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-city-header">
              <span className="font-accent">PICK A CITY</span>
              <button
                type="button"
                className="mobile-city-close"
                onClick={() => setShowMobileCities(false)}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="mobile-city-grid">
              {availableCities.length > 0 ? (
                availableCities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className="font-accent mobile-city-btn"
                    onClick={() => {
                      setShowMobileCities(false);
                      replaceResultsUrl({ location: city, type: activeTab });

                    }}
                  >
                    {city}
                  </button>
                ))
              ) : (
                <div className="font-accent city-option" aria-disabled>
                  No cities available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
