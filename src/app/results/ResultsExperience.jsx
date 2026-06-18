"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import logoImage from "@/app/assets/Tx-Localist-01.png";
import SearchBar from "@/components/SearchBar";
import { getBlobImageUrl } from "@/lib/blob";

import {
  ArrowRightIcon,
  CameraIcon,
  LoaderIcon,
  MapPinIcon,
  PlusCircleIcon,
  ShareIcon,
} from "./icons";

function buildSuggestBusinessHref({ query = "", location = "" } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("name", query);
  if (location) params.set("city", location);
  const queryString = params.toString();
  return queryString ? `/suggest-business?${queryString}` : "/suggest-business";
}

/* ─── Card views ──────────────────────────────────────────── */
function BusinessCard({ biz, saved, count, onSave }) {
  return (
    <article className="gem-card card-stack-effect">
      {biz.image?.url && biz.image.url !== "/placeholder.jpg" && (
        <div className="gem-image-wrapper">
          <img src={getBlobImageUrl(biz.image.url)} alt={biz.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div className="category-tag">{biz.city?.name ?? biz.city}</div>
      <h4 className="gem-name">{biz.name}</h4>
      <p className="gem-desc">
        {biz.description?.slice(0, 120)}{biz.description?.length > 120 ? "..." : ""}
      </p>
      <div className="gem-footer">
        <button type="button" onClick={onSave} className={"save-btn font-accent" + (saved ? " save-btn-saved" : "")}>
          <span className="material-icons save-btn-icon">{saved ? "favorite" : "favorite_border"}</span>
          {count > 0 ? `${count} saved` : "Save"}
        </button>
        <Link href={"/business/" + biz.slug} className="gem-action-btn">
          <ArrowRightIcon size={16} />
        </Link>
      </div>
    </article>
  );
}

function EventCard({ event }) {
  const fmt = (val) => val
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(val))
    : null;
  return (
    <article className="gem-card card-stack-effect">
      {event.imageUrl && (
        <div className="gem-image-wrapper">
          <img src={getBlobImageUrl(event.imageUrl)} alt={event.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div className="category-tag bg-retro-red text-white">
        {event.startDate ? fmt(event.startDate) : "EVENT"}
      </div>
      <h4 className="gem-name">{event.title}</h4>
      <p className="gem-desc">
        {event.description?.slice(0, 100)}{event.description?.length > 100 ? "..." : ""}
      </p>
      <p className="gem-address" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
        {event.addressName || event.address} &middot; {event.city}
      </p>
      <div className="gem-footer">
        <span className="font-accent gem-meta">{event.city}, {event.state}</span>
        <Link href="/events" className="gem-action-btn"><ArrowRightIcon size={16} /></Link>
      </div>
    </article>
  );
}

/* ─── List-row views ──────────────────────────────────────── */
function BusinessRow({ biz, saved, count, onSave }) {
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
        </div>
        <h4 className="list-item-name">{biz.name}</h4>
        <p className="list-item-desc">
          {biz.description?.slice(0, 160)}{biz.description?.length > 160 ? "..." : ""}
        </p>
        <button type="button" onClick={onSave} className={"save-btn save-btn-sm font-accent" + (saved ? " save-btn-saved" : "")}>
          <span className="material-icons save-btn-icon">{saved ? "favorite" : "favorite_border"}</span>
          {count > 0 ? `${count} saved` : "Save"}
        </button>
      </div>
      <Link href={"/business/" + biz.slug} className="gem-action-btn list-item-arrow">
        <ArrowRightIcon size={16} />
      </Link>
    </article>
  );
}

function EventRow({ event }) {
  const fmt = (val) => val
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(val))
    : null;
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
            {event.startDate ? fmt(event.startDate) : "EVENT"}
          </span>
          <span className="font-accent list-item-cat">{event.city}</span>
        </div>
        <h4 className="list-item-name">{event.title}</h4>
        <p className="list-item-desc">
          {event.description?.slice(0, 160)}{event.description?.length > 160 ? "..." : ""}
        </p>
      </div>
      <Link href="/events" className="gem-action-btn list-item-arrow">
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
  user = null,
  dashboardPath = null,
  savedIds = [],
  initialFavoriteBusinesses = [],
  availableTags = [],
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
  const [viewMode,         setViewMode]         = useState("card"); // "card" | "list" | "map"
  const [showCities,       setShowCities]       = useState(false);
  const [showCategories,   setShowCategories]   = useState(false);
  const [showMobileCities, setShowMobileCities] = useState(false);
  const [activeSort,       setActiveSort]       = useState(""); // "" | "popular"
  const [activeBrowseTab,  setActiveBrowseTab]  = useState(initialQuery || initialLocation ? "search" : "");
  const [favoriteBusinesses, setFavoriteBusinesses] = useState(initialFavoriteBusinesses);

  // Saved state: tracks { [businessId]: { saved, count } } for optimistic UI
  const [savedMap, setSavedMap] = useState(() =>
    Object.fromEntries(savedIds.map((id) => [id, { saved: true }]))
  );

  const currentYear = new Date().getFullYear();
  const mapsApiKey  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const suggestBusinessHref = buildSuggestBusinessHref({
    query: lastSearch.q,
    location: lastSearch.loc,
  });

  function replaceResultsUrl({ query = "", location = "", type = "businesses" }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (location) params.set("loc", location);
    if (type && type !== "businesses") params.set("tab", type);

    const queryString = params.toString();
    router.replace(queryString ? "/results?" + queryString : "/results", { scroll: false });
  }

  useEffect(() => {
    const urlTab = urlParams.get("tab") === "events" ? "events" : "businesses";
    setActiveTab((current) => (current === urlTab ? current : urlTab));
  }, [urlParams]);

  useEffect(() => {
    if (initialQuery || initialLocation) runSearch(initialQuery, initialLocation, "", "search");
  }, []);

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

  async function runSearch(q, loc, sort = "", browseTab = "search") {
    setIsSearching(true);
    setHasSearched(true);
    setLastSearch({ q, loc });
    setActiveSort(sort);
    setActiveBrowseTab(browseTab);

    const bizP = new URLSearchParams();
    if (q)    bizP.set("q",    q);
    if (loc)  bizP.set("loc",  loc);
    if (sort) bizP.set("sort", sort);

    const evtP = new URLSearchParams();
    if (loc) evtP.set("city", loc);
    else if (q) evtP.set("city", q);
    evtP.set("limit", "12");

    try {
      const [bizRes, evtRes] = await Promise.all([
        fetch("/api/search?" + bizP).then((r) => r.json()),
        fetch("/api/events?" + evtP).then((r) => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
      ]);
      const bizList = bizRes?.data?.results ?? [];
      const evtList = evtRes?.events ?? [];
      setBusinesses(bizList);
      setEvents(evtList);
    } catch (_) {
      setBusinesses([]);
      setEvents([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchBarSubmit({ query, location, type }) {
    setActiveTab(type);
    replaceResultsUrl({ query, location, type });
    runSearch(query, location, "", "search");
  }

  function clearSearch() {
    setBusinesses([]);
    setEvents([]);
    setHasSearched(false);
    setActiveSort("");
    setActiveBrowseTab("");
    router.replace("/results", { scroll: false });
  }

  function openNewListings() {
    setActiveTab("businesses");
    setViewMode("card");
    replaceResultsUrl({ query: "", location: "", type: "businesses" });
    runSearch("", "", "", "new");
  }

  function openMostSaved() {
    setActiveTab("businesses");
    setViewMode("card");
    replaceResultsUrl({ query: "", location: lastSearch.loc, type: "businesses" });
    runSearch("", lastSearch.loc, "popular", "popular");
  }

  function openFavorites() {
    if (!user) {
      router.push("/login?next=/results");
      return;
    }

    setActiveTab("businesses");
    setViewMode("card");
    setActiveSort("");
    setActiveBrowseTab("favorites");
    setHasSearched(true);
    replaceResultsUrl({ query: "", location: "", type: "businesses" });
  }

  function removeQueryFilter() {
    if (activeBrowseTab === "favorites") return;

    const nextQuery = "";
    const nextLocation = activeBrowseTab === "new" ? "" : lastSearch.loc;

    if (!nextLocation && activeTab === "businesses" && activeBrowseTab !== "popular") {
      clearSearch();
      return;
    }

    replaceResultsUrl({ query: nextQuery, location: nextLocation, type: activeTab });
    runSearch(nextQuery, nextLocation, activeSort, activeBrowseTab || "search");
  }

  function removeLocationFilter() {
    if (activeBrowseTab === "favorites") return;

    const nextLocation = "";

    if (!lastSearch.q && activeTab === "businesses" && activeBrowseTab !== "popular") {
      clearSearch();
      return;
    }

    replaceResultsUrl({ query: lastSearch.q, location: nextLocation, type: activeTab });
    runSearch(lastSearch.q, nextLocation, activeSort, activeBrowseTab || "search");
  }

  function removeBrowseFilter() {
    if (activeBrowseTab === "favorites") {
      if (lastSearch.q || lastSearch.loc) {
        replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, type: activeTab });
        runSearch(lastSearch.q, lastSearch.loc, "", "search");
      } else {
        clearSearch();
      }
      return;
    }

    if (lastSearch.q || lastSearch.loc || activeTab === "events") {
      replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, type: activeTab });
      runSearch(lastSearch.q, lastSearch.loc, "", "search");
    } else {
      clearSearch();
    }
  }

  function removeEventsFilter() {
    setActiveTab("businesses");

    if (lastSearch.q || lastSearch.loc) {
      replaceResultsUrl({ query: lastSearch.q, location: lastSearch.loc, type: "businesses" });
      runSearch(lastSearch.q, lastSearch.loc, "", "search");
    } else {
      clearSearch();
    }
  }

  async function toggleSave(biz) {
    if (!user) {
      router.push("/login?next=/results");
      return;
    }
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
    }
  }

  function getSaveState(biz) {
    const override = savedMap[biz.id];
    return {
      saved: override?.saved ?? false,
      count: override?.count ?? biz.favoritesCount ?? 0,
    };
  }

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
      label: "New",
      tone: "new",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && activeBrowseTab === "popular") {
    activeFilterChips.push({
      key: "popular",
      label: "Most Saved",
      tone: "popular",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && activeBrowseTab === "favorites") {
    activeFilterChips.push({
      key: "favorites",
      label: "My Favorites",
      tone: "favorites",
      onRemove: removeBrowseFilter,
    });
  }

  if (hasSearched && activeBrowseTab !== "favorites" && lastSearch.q) {
    activeFilterChips.push({
      key: "query",
      label: `Query: ${lastSearch.q}`,
      tone: "default",
      onRemove: removeQueryFilter,
    });
  }

  if (hasSearched && activeBrowseTab !== "favorites" && lastSearch.loc) {
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
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "2rem 0", color: "var(--muted)" }}>
          <LoaderIcon size={24} className="animate-spin" />
          <span className="font-accent">SEARCHING...</span>
        </div>
      );
    }

    /* ── Map view placeholder ── */
    if (viewMode === "map") {
      return (
        <div className="results-map-placeholder">
          <MapPinIcon size={52} style={{ color: "var(--retro-red)", marginBottom: "1rem" }} />
          <h4 className="font-display results-map-title">Map View</h4>
          <p className="results-map-desc">
            Interactive map results are coming soon.<br />
            Drop a pin on your city and explore what&apos;s nearby.
          </p>
          <div className="font-accent results-map-badge">COMING SOON</div>
        </div>
      );
    }

    /* ── Business results ── */
    if (activeTab === "businesses") {
      const visibleBusinesses = activeBrowseTab === "favorites" ? favoriteBusinesses : businesses;

      if (visibleBusinesses.length === 0) {
        return activeBrowseTab === "favorites"
          ? (
              <EmptyResultsState
                eyebrow="Saved list"
                title="Your favorites list is still empty."
                description="Tap the heart on any listing and it will land here for quick revisits."
                primaryLabel="Explore Businesses"
                primaryAction={clearSearch}
                secondaryLabel="Suggest a Business"
                secondaryHref={suggestBusinessHref}
              />
            )
          : (
              <EmptyResultsState
                eyebrow="No matches"
                title="Nothing matched that search."
                description="Try broadening your search, removing a filter chip, or telling us about a great local business we should add."
                primaryLabel="Clear Filters"
                primaryAction={clearSearch}
                secondaryLabel="Suggest a Business"
                secondaryHref={suggestBusinessHref}
              />
            );
      }

      return viewMode === "list"
        ? <div className="list-container">{visibleBusinesses.map((b) => {
            const { saved, count } = getSaveState(b);
            return <BusinessRow key={b.id} biz={b} saved={saved} count={count} onSave={() => toggleSave(b)} />;
          })}</div>
        : <div className="grid-container">{visibleBusinesses.map((b) => {
            const { saved, count } = getSaveState(b);
            return <BusinessCard key={b.id} biz={b} saved={saved} count={count} onSave={() => toggleSave(b)} />;
          })}</div>;
    }

    /* ── Event results ── */
    if (events.length === 0) {
      return (
        <EmptyResultsState
          eyebrow="No events"
          title={`No events found near ${lastSearch.loc || lastSearch.q || "this area"}.`}
          description="If you know about something worth showing up for, send it our way or post one from the dashboard."
          primaryLabel="Suggest a Local Spot"
          primaryHref={suggestBusinessHref}
          secondaryLabel="Clear Filters"
          secondaryAction={clearSearch}
        />
      );
    }
    return viewMode === "list"
      ? <div className="list-container">{events.map((e) => <EventRow key={e.id} event={e} />)}</div>
      : <div className="grid-container">{events.map((e) => <EventCard key={e.id} event={e} />)}</div>;
  }

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-content">
          <Image src={logoImage} alt="Texas Localist" width={220} height={140}
            sizes="220px" className="logo-image" priority />
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
                          replaceResultsUrl({ query: "", location: city, type: activeTab });
                          runSearch("", city, "", "search");
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
                  {availableTags.length > 0 ? (
                    availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="font-accent city-option"
                        onClick={() => {
                          setShowCategories(false);
                          setActiveTab("businesses");
                          replaceResultsUrl({ query: tag.name, location: lastSearch.loc, type: "businesses" });
                          runSearch(tag.name, lastSearch.loc, "", "search");
                        }}
                      >
                        <span className="material-icons city-option-pin">sell</span>
                        {tag.name}
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
                  <span className="material-icons">favorite</span>
                </span>
                <span className="sidebar-browse-label">MY FAVORITES</span>
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
              <Image src={logoImage} alt="Texas Localist" width={260} height={160}
                sizes="(max-width: 768px) 220px, 260px" className="mobile-logo-image" priority />
            </div>
            <SearchBar
              action="/results"
              initialQuery={activeBrowseTab === "favorites" ? "" : lastSearch.q}
              initialLocation={activeBrowseTab === "favorites" ? "" : lastSearch.loc}
              defaultLocation={activeBrowseTab === "favorites" ? "" : "Austin, TX"}
              initialType={activeTab}
              variant="inline"
              autoSubmitOnTypeChange
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
                            ? favoriteBusinesses.length
                            : businesses.length
                        } ${
                          (activeBrowseTab === "favorites" ? favoriteBusinesses.length : businesses.length) !== 1
                            ? "BUSINESSES"
                            : "BUSINESS"
                        }${
                          activeBrowseTab === "favorites"
                            ? " · MY FAVORITES"
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
                  <div className="view-toggle" role="group" aria-label="View mode">
                    {[
                      { mode: "card", icon: "grid_view",  label: "Card view" },
                      { mode: "list", icon: "view_list",  label: "List view" },
                      { mode: "map",  icon: "map",        label: "Map view"  },
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
                    If something great is missing from the directory, tell us and we&apos;ll take a look.
                  </p>
                </div>
                <div className="results-trust-actions">
                  <Link href={suggestBusinessHref} className="results-trust-primary">
                    Suggest a Business
                  </Link>
                  <Link href="/post-your-business" className="results-trust-secondary">
                    Add Your Listing
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ── Default browse state — full-width map ── */}
          {!hasSearched && (
            <section className="map-section-full" aria-label="Explore Texas">
              <div className="map-header">
                <h3 className="map-title">Explore the <span className="text-retro-orange">Map</span></h3>
                <span className="font-accent map-subtitle">INTERACTIVE VIEW</span>
              </div>
              <div className="map-container-full card-stack-effect">
                {mapsApiKey && (
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0, display: "block" }}
                    src={"https://www.google.com/maps/embed/v1/search?key=" + mapsApiKey + "&q=local+gems+Texas&center=31.9686,-99.9018&zoom=6"}
                    allowFullScreen
                    title="Texas Localist Map"
                  />
                )}
                {!mapsApiKey && (
                  <div className="map-overlay">
                    <div className="map-overlay-content">
                      <MapPinIcon size={48} className="map-pin-icon" style={{ color: "var(--retro-red)" }} />
                      <h4 className="map-overlay-title">Map Preview</h4>
                      <p className="map-overlay-desc">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the live map.</p>
                      <div className="font-accent demo-badge">DEMO MODE</div>
                    </div>
                  </div>
                )}
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
                      replaceResultsUrl({ query: "", location: city, type: activeTab });
                      runSearch("", city, "", "search");
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
