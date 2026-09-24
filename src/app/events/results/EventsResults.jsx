"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import DirectoryImage from "@/components/DirectoryImage";
import EventSearchBar from "@/components/EventSearchBar/EventSearchBar";
import { LikeCount } from "@/components/LikeCount";
import NavbarMobileMenu from "@/components/Navbar/NavbarMobileMenu";

import "./events-results.css";
import ResultsSort from "@/components/ResultsSort/ResultsSort";
import toolbarStyles from "@/components/ResultsSort/MobileResultsToolbar.module.css";
import { normalizeSort, sortResults } from "@/lib/results-sort";
import { formatEventDateRange } from "@/lib/event-dates";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MOBILE_PAGE_SIZE = 12;
function subscribeMobileViewport(callback) {
  const query = window.matchMedia("(max-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getMobileViewport = () => window.matchMedia("(max-width: 768px)").matches;
const getServerViewport = () => false;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "this-weekend", label: "This Weekend" },
  { value: "next-7-days", label: "Next 7 Days" },
  { value: "", label: "All Dates" },
];
const PRIMARY_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/results", label: "Businesses" },
  { href: "/events", label: "Happenings" },
  { href: "/about", label: "About" },
  { href: "/post-your-business", label: "Add Listing" },
];
const CATEGORY_COLORS = [
  "#37b3b1",
  "#f18824",
  "#df5a41",
  "#7ab273",
  "#f4ca46",
  "#b97be4",
  "#5d8df4",
  "#ef7fa6",
];

const displayCategory = (category) => category === "Free Events" ? "Free Happenings" : category;

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateObj(key) {
  if (!key || key === "undated") return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function keyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayKey() {
  return keyFromDate(new Date());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateWindowKeys(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Set([value]);

  const today = dateObj(todayKey());
  if (!today) return null;
  if (value === "today" || value === "tonight") return new Set([keyFromDate(today)]);
  if (value === "tomorrow") return new Set([keyFromDate(addDays(today, 1))]);
  if (value === "next-7-days") {
    return new Set(Array.from({ length: 7 }, (_, index) => keyFromDate(addDays(today, index))));
  }
  if (value === "this-weekend") {
    const day = today.getDay();
    const friday = addDays(today, day <= 5 ? 5 - day : -1);
    return new Set([0, 1, 2].map((offset) => keyFromDate(addDays(friday, offset))));
  }
  return null;
}

function fmtLong(key) {
  const date = dateObj(key);
  if (!date) return "Date TBD";
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function monthShort(key) {
  const date = dateObj(key);
  return date ? MONTHS[date.getMonth()].slice(0, 3).toUpperCase() : "TBD";
}

function eventDate(event) {
  return dateObj(event.dateKey) || new Date(8640000000000000);
}

function eventDateKeys(event) {
  if (Array.isArray(event.dateKeys) && event.dateKeys.length) {
    return event.dateKeys;
  }
  return event.dateKey && event.dateKey !== "undated" ? [event.dateKey] : [];
}

function eventOccursOn(event, dateKey) {
  return eventDateKeys(event).includes(dateKey);
}

function eventIsOngoingOn(event, dateKey) {
  if (event.recurrence === "WEEKLY") {
    const occurrence = event.occurrences?.find((item) => item.dateKeys.includes(dateKey));
    return Boolean(occurrence && occurrence.dateKeys[0] !== dateKey);
  }
  const [startKey] = eventDateKeys(event);
  return Boolean(dateKey && startKey && dateKey !== startKey && eventOccursOn(event, dateKey));
}

function eventTimeLabelOn(event, dateKey) {
  return eventIsOngoingOn(event, dateKey) ? "Ongoing" : event.timeLabel;
}

function firstSelectableEventDate(events, dateFilter) {
  const filterKeys = dateWindowKeys(dateFilter);
  if (filterKeys) {
    for (const dateKey of filterKeys) {
      if (events.some((event) => eventOccursOn(event, dateKey))) {
        return dateKey;
      }
    }
  }

  return events.flatMap(eventDateKeys)[0] || "";
}

function eventTypeClass(event) {
  const text = [event.type, ...(event.tags || [])].join(" ").toLowerCase();
  if (text.includes("music")) return "music";
  if (text.includes("market") || text.includes("food") || text.includes("drink")) return "market";
  if (text.includes("night") || text.includes("dance")) return "night";
  if (text.includes("family")) return "family";
  return "outdoor";
}

function getEventCategoryNames(event) {
  return (event.categoryTags || []).map((category) => category.name).filter(Boolean);
}

function imageTone(event) {
  const type = eventTypeClass(event);
  if (type === "market") return "img-market";
  if (type === "night") return "img-jazz";
  if (type === "family" || type === "outdoor") return "img-outdoor";
  return "img-music";
}

function ticketTone(index) {
  return ["teal", "orange", "yellow", "red"][index % 4];
}

function filterEvents(events, { query, city, category, date }) {
  const q = query.trim().toLowerCase();
  const cityValue = city.trim().toLowerCase();
  const categoryValue = category.trim().toLowerCase();
  const keys = dateWindowKeys(date);

  return events
    .filter((event) => {
      if (q) {
        const haystack = [
          event.title,
          event.description,
          event.venue,
          event.cityLabel,
          event.type,
          ...(event.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (cityValue) {
        const haystack = [event.cityLabel, event.city, event.state].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(cityValue)) return false;
      }

      if (categoryValue) {
        const values = [event.type, ...(event.tags || [])].filter(Boolean).map((item) => item.toLowerCase());
        if (!values.includes(categoryValue)) return false;
      }

      if (keys && !eventDateKeys(event).some((key) => keys.has(key))) return false;

      return true;
    })
    .sort((a, b) => eventDate(a) - eventDate(b) || String(a.timeLabel).localeCompare(String(b.timeLabel)));
}

function timeBucket(event, dateKey) {
  if (eventIsOngoingOn(event, dateKey)) return "Ongoing";
  if (!event.startDate) return "Tonight";
  const hour = Number.isInteger(event.startHour)
    ? event.startHour
    : new Date(event.startDate).getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Tonight";
}

function Logo({ mobile = false }) {
  return (
    <Link href="/events" className={mobile ? "brand-image mobile" : "brand-image"} aria-label="Texas Localist happenings">
      <Image src="/Dark-mode-logo.svg" alt="Texas Localist" width={mobile ? 170 : 224} height={mobile ? 82 : 108} priority />
    </Link>
  );
}

function EventThumb({ event }) {
  const imageUrl = event.imageUrl;
  if (imageUrl) {
    return (
      <div className="thumb real-thumb">
        <DirectoryImage src={imageUrl} alt="" sizes="(max-width: 700px) 100vw, 176px" />
      </div>
    );
  }
  return <div className={`thumb ${imageTone(event)}`} />;
}

export default function EventsResults({
  events = [],
  allEvents = events,
  cities = [],
  categories = [],
  isLoggedIn = false,
  dashboardPath = "/dashboard",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useSyncExternalStore(subscribeMobileViewport, getMobileViewport, getServerViewport);

  const [view, setView] = useState("cards");
  // Native history updates and Back/Forward must restore both controls and results.
  // Keep committed filters in the URL; search-field drafts live in EventSearchBar.
  const sort = normalizeSort(searchParams.get("sort"), "upcoming", ["upcoming"]);
  const query = searchParams.get("q") || "";
  const city = searchParams.get("loc") || "";
  const dateFilter = searchParams.get("date") || "";
  const categoryFilter = searchParams.get("category") || "";
  const savedOnly = searchParams.get("saved") === "1";
  const [savedIds, setSavedIds] = useState(
    () => new Set(allEvents.filter((event) => event.isSaved).map((event) => event.id))
  );
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [accordions, setAccordions] = useState({ citiesNav: false, catsNav: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState("");

  const matchingEvents = useMemo(
    () => filterEvents(allEvents, { query, city, category: categoryFilter, date: dateFilter }),
    [allEvents, query, city, categoryFilter, dateFilter]
  );
  const filtered = useMemo(
    () => savedOnly
      ? matchingEvents.filter((event) => savedIds.has(event.id))
      : matchingEvents,
    [matchingEvents, savedIds, savedOnly]
  );

  const firstVisibleDate = firstSelectableEventDate(filtered, dateFilter);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter) ? dateFilter : "";
  const [month, setMonth] = useState(() => {
    const date = dateObj(firstVisibleDate) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setMonthModalOpen(false);
        setDayModalDate("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () => sortResults(selectedDate ? filtered.filter((event) => eventOccursOn(event, selectedDate)) : filtered, sort, { extras: ["upcoming"] }),
    [filtered, selectedDate, sort]
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / MOBILE_PAGE_SIZE));
  const currentPage = Math.min(pageCount, Math.max(1, parseInt(searchParams.get("page"), 10) || 1));
  const pageEvents = useMemo(() => isMobile
    ? visible.slice((currentPage - 1) * MOBILE_PAGE_SIZE, currentPage * MOBILE_PAGE_SIZE)
    : visible, [visible, currentPage, isMobile]);

  const calendarCounts = useMemo(() => {
    const counts = {};
    filtered.forEach((event) => {
      eventDateKeys(event).forEach((dateKey) => {
        (counts[dateKey] ||= []).push(event);
      });
    });
    return counts;
  }, [filtered]);

  const categoryColorMap = useMemo(() => {
    const names = [...new Set(categories.filter(Boolean))];
    return new Map(
      names.map((name, index) => [name, CATEGORY_COLORS[index % CATEGORY_COLORS.length]])
    );
  }, [categories]);

  const legendCategories = useMemo(() => {
    const counts = new Map();

    allEvents.forEach((event) => {
      getEventCategoryNames(event).forEach((name) => {
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });

    return [...categories]
      .sort((a, b) => {
        const countDelta = (counts.get(b) || 0) - (counts.get(a) || 0);
        return countDelta || a.localeCompare(b);
      })
      .slice(0, 8);
  }, [allEvents, categories]);

  const calendarCells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = keyFromDate(date);
      const dayEvents = calendarCounts[key] || [];
      return {
        key,
        number: date.getDate(),
        count: dayEvents.length,
        preview: dayEvents[0]?.title || "",
        uniqueCategories: [...new Set(dayEvents.flatMap(getEventCategoryNames))].slice(0, 4),
        isHot: dayEvents.length >= 3,
        isToday: key === todayKey(),
        dim: date.getMonth() !== m,
      };
    });
  }, [month, calendarCounts]);

  const agendaForSelected = useMemo(
    () => filtered.filter((event) => eventOccursOn(event, selectedDate)),
    [filtered, selectedDate]
  );

  const agendaBuckets = useMemo(() => {
    const buckets = { Ongoing: [], Morning: [], Afternoon: [], Tonight: [] };
    agendaForSelected.forEach((event) => buckets[timeBucket(event, selectedDate)].push(event));
    return buckets;
  }, [agendaForSelected, selectedDate]);

  const listGroups = useMemo(() => {
    if (sort !== "upcoming") return pageEvents.length ? [["sorted", pageEvents]] : [];
    const grouped = {};
    pageEvents.forEach((event) => {
      const key = selectedDate || event.dateKey || "undated";
      (grouped[key] ||= []).push(event);
    });
    return Object.entries(grouped);
  }, [pageEvents, selectedDate, sort]);

  const selectedDateObj = dateObj(selectedDate);
  const monthTitle = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  function updateUrl(next = {}) {
    const params = new URLSearchParams();
    const nextSort = next.sort ?? sort;
    const nextQuery = next.query ?? query;
    const nextCity = next.city ?? city;
    const nextDate = next.date ?? dateFilter;
    const nextCategory = next.category ?? categoryFilter;
    const nextSaved = next.saved ?? savedOnly;
    if (nextSort && nextSort !== "upcoming") params.set("sort", nextSort);
    if (nextQuery) params.set("q", nextQuery);
    if (nextCity) params.set("loc", nextCity);
    if (nextDate) params.set("date", nextDate);
    if (nextCategory) params.set("category", nextCategory);
    if (nextSaved) params.set("saved", "1");
    if (next.page > 1) params.set("page", String(next.page));
    // All events are already loaded for the calendar; filtering is local.
    window.history.pushState(null, "", params.toString() ? `/events/results?${params.toString()}` : "/events/results");
  }

  const activeFilterChips = [
    city
      ? {
          key: "city",
          label: city,
          clear: () => {
            updateUrl({ city: "" });
          },
        }
      : null,
    dateFilter
      ? {
          key: "date",
          label: DATE_FILTERS.find((item) => item.value === dateFilter)?.label || dateFilter,
          clear: () => {
            updateUrl({ date: "" });
          },
        }
      : null,
    categoryFilter
      ? {
          key: "category",
          label: displayCategory(categoryFilter),
          clear: () => {
            updateUrl({ category: "" });
          },
        }
      : null,
    savedOnly
      ? {
          key: "saved",
          label: "Saved Happenings",
          clear: () => {
            updateUrl({ saved: false });
          },
        }
      : null,
  ].filter(Boolean);

  function handleSearchSubmit(values) {
    updateUrl({
      query: values.query,
      city: values.location,
      date: values.date,
      saved: false,
    });
  }

  function selectCity(value) {
    updateUrl({ city: value });
  }

  function selectCategory(value) {
    updateUrl({ category: value });
  }

  function selectDay(key) {
    updateUrl({ date: key });
    setDayModalDate(key);
  }

  function shiftMonth(delta) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function goToday() {
    const today = dateObj(todayKey()) || new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    selectDay(keyFromDate(today));
  }

  async function toggleSave(id) {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    const wasSaved = savedIds.has(id);
    setSavingIds((current) => new Set(current).add(id));
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });

    try {
      const response = await fetch("/api/event-favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update saved happenings.");
      setSavedIds((current) => {
        const next = new Set(current);
        if (data.saved) next.add(id);
        else next.delete(id);
        return next;
      });
      router.refresh();
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function openSavedEvents() {
    if (!isLoggedIn) {
      router.push("/login?next=/events/results?saved=1");
      return;
    }
    setView("cards");
    updateUrl({ saved: true });
  }

  function handleBottomNav(action) {
    if (action === "businesses") router.push("/results");
    if (action === "calendar") setMonthModalOpen(true);
    if (action === "filters") setDrawerOpen(true);
    if (action === "saved") openSavedEvents();
    if (action === "account") router.push(isLoggedIn ? dashboardPath : "/login");
  }

  function clearAllFilters() {
    setView("cards");
    updateUrl({ query: "", city: "", date: "", category: "", saved: false });
    setDrawerOpen(false);
  }

  const dayModalEvents = dayModalDate ? calendarCounts[dayModalDate] || [] : [];

  function renderCalendarGrid(keyPrefix) {
    return (
      <>
        {DAYS.map((day) => (
          <div key={`${keyPrefix}-dow-${day}`} className="dow">
            {day}
          </div>
        ))}
        {calendarCells.map((cell) => {
          const classes = [
            "day-cell",
            cell.count ? "has-events" : "",
            cell.dim ? "dim" : "",
            cell.isHot ? "hot" : "",
            cell.key === selectedDate ? "selected" : "",
            cell.isToday ? "today" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={`${keyPrefix}-${cell.key}`}
              type="button"
              className={classes}
              aria-label={`${fmtLong(cell.key)}${cell.count ? `, ${cell.count} happenings` : ", no happenings"}`}
              onClick={() => selectDay(cell.key)}
            >
              <div className="day-top">
                <div className="day-number">{cell.number}</div>
                {cell.count ? <div className="count-badge">{cell.count}</div> : null}
              </div>
              {cell.uniqueCategories.length ? (
                <div className="dots">
                  {cell.uniqueCategories.map((category) => (
                    <i
                      key={category}
                      className="dot"
                      title={category}
                      style={{ backgroundColor: categoryColorMap.get(category) || CATEGORY_COLORS[0] }}
                    />
                  ))}
                </div>
              ) : null}
              {cell.preview ? <div className="cell-preview">{cell.preview}</div> : null}
            </button>
          );
        })}
      </>
    );
  }

  function renderEventCard(event, index) {
    const occurrence = selectedDate && event.occurrences?.find((item) => item.dateKeys.includes(selectedDate));
    if (occurrence) event = {
      ...event, ...occurrence, dateKey: occurrence.dateKeys[0],
      shortDateRangeLabel: formatEventDateRange(occurrence.startDate, occurrence.endDate, event.timezone, { compact: true }),
    };
    const isSaved = savedIds.has(event.id);
    return (
      <article key={event.id} className="event-card">
        <Link
          href={`/events/${event.id}${occurrence ? `?date=${occurrence.dateKeys[0]}` : ""}`}
          className="event-card-link"
          aria-label={`View ${event.title}`}
        />
        <div className={`ticket ${ticketTone(index)}`}>
          <div>
            <div className="month">
              {dateObj(event.dateKey) ? `${DAYS[dateObj(event.dateKey).getDay()].toUpperCase()} ${monthShort(event.dateKey)}` : "DATE TBD"}
            </div>
            <div className="date">{dateObj(event.dateKey)?.getDate() || "--"}</div>
          </div>
          <div className="time">{eventTimeLabelOn(event, selectedDate)}</div>
        </div>
        <EventThumb event={event} />
        <div className="card-body">
          <span className="card-tag">{event.type}</span>
          <h2 className="card-title">
            {event.title}
            <small>{event.venue}</small>
          </h2>
          <div className="card-meta">
            {event.recurrenceLabel ? `${event.recurrenceLabel} · ` : ""}
            {eventDateKeys(event).length > 1 ? `${event.shortDateRangeLabel} · ` : ""}
            {event.venue} &middot; {event.cityLabel}
          </div>
          <div className="meta-row">
            {(event.tags || []).slice(0, 3).map((tag) => (
              <span key={tag} className="mini-tag">
                {tag}
              </span>
            ))}
          </div>
          <div className="actions">
            <LikeCount
              count={event.likesCount ?? 0}
              size="sm"
              targetType="event"
              targetId={event.id}
              targetName={event.title}
              initialLiked={Boolean(event.isLiked)}
              isLoggedIn={isLoggedIn}
            />
            <button
              className={`tiny-btn${isSaved ? " saved" : ""}`}
              onClick={() => toggleSave(event.id)}
              disabled={savingIds.has(event.id)}
              aria-pressed={isSaved}
            >
              {savingIds.has(event.id) ? "Saving" : isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className={`events-results view-${view}`}>
      <div className="mobile-top">
        <Logo mobile />
        <NavbarMobileMenu
          theme="dark"
          links={PRIMARY_NAV_LINKS}
          pillHref={isLoggedIn ? dashboardPath : "/login"}
          pillLabel={isLoggedIn ? "Dashboard" : "Login"}
          activeHref="/events"
        />
      </div>

      <div className="app">
        <aside className="sidebar">
          <Logo />

          <div className="nav-stack">
            <Link className="nav-item" href="/">
              <span className="icon-bubble"><span className="material-icons" aria-hidden="true">home</span></span>
              <span className="grow">Home</span>
            </Link>
            <Link className="nav-item" href="/results">
              <span className="icon-bubble"><span className="material-icons" aria-hidden="true">storefront</span></span>
              <span className="grow">Businesses</span>
            </Link>
            <button className={`nav-item${!savedOnly ? " active" : ""}`} type="button" onClick={clearAllFilters}>
              <span className="icon-bubble"><span className="material-icons" aria-hidden="true">event</span></span>
              <span className="grow">All Happenings</span>
            </button>

            <button
              className={`nav-item${accordions.citiesNav ? " expanded" : ""}`}
              onClick={() => setAccordions((value) => ({ ...value, citiesNav: !value.citiesNav }))}
            >
              <span className="icon-bubble">⌖</span>
              <span className="grow">Cities</span>
              <span className="caret">⌄</span>
            </button>
            <div className={`subnav${accordions.citiesNav ? " open" : ""}`}>
              {cities.length ? (
                cities.map((value) => (
                  <button
                    key={value}
                    className={`sub-item${city === value ? " active-sub" : ""}`}
                    onClick={() => selectCity(value)}
                  >
                    {value.replace(", TX", "")}
                  </button>
                ))
              ) : (
                <span className="sub-item muted-sub">No cities yet</span>
              )}
            </div>

            <button
              className={`nav-item${accordions.catsNav ? " expanded" : ""}`}
              onClick={() => setAccordions((value) => ({ ...value, catsNav: !value.catsNav }))}
            >
              <span className="icon-bubble">◇</span>
              <span className="grow">Categories</span>
              <span className="caret">⌄</span>
            </button>
            <div className={`subnav${accordions.catsNav ? " open" : ""}`}>
              {categories.length ? (
                categories.map((value) => (
                  <button
                    key={value}
                    className={`sub-item${categoryFilter === value ? " active-sub" : ""}`}
                    onClick={() => selectCategory(value)}
                  >
                    {displayCategory(value)}
                  </button>
                ))
              ) : (
                <span className="sub-item muted-sub">No categories yet</span>
              )}
            </div>

            <Link className="nav-item" href="/post-your-business">
              <span className="icon-bubble">+</span>
              <span className="grow">Add Listing</span>
            </Link>
            <Link className="login-btn" href={isLoggedIn ? dashboardPath : "/login"}>
              {isLoggedIn ? "Dashboard" : "Login"}
            </Link>
          </div>

          <div className="side-divider" />

          <button className={`browse-item${savedOnly ? " active" : ""}`} onClick={openSavedEvents}>
            <span className="browse-bubble bubble-fav"><span className="material-icons" aria-hidden="true">bookmark</span></span>
            <span>Saved Happenings</span>
          </button>

          <div className="side-footer">
            &copy; 2026 Texas Localist.
            <br />
            Handcrafted in the Lone Star State.
          </div>
        </aside>

        <main className="main">
          <div className="container">
            <EventSearchBar
              key={`${query}|${city}|${dateFilter}`}
              initialQuery={query}
              initialLocation={city}
              initialDate={dateFilter}
              onSearch={handleSearchSubmit}
            />

            <div className="top-actions">
              <div className={`view-tools ${toolbarStyles.toolbar}`}>
                <ResultsSort
                  value={sort}
                  events
                  onChange={(next) => {
                    updateUrl({ sort: next });
                  }}
                />
                <div className={`summary-pill ${toolbarStyles.desktopOnly}`}>
                  <span>{visible.length}</span> events
                  {selectedDateObj ? (
                    <>
                      {" "}on <span>{`${MONTHS[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`}</span>
                    </>
                  ) : null}
                  {city ? (
                    <>
                      {" "}near <span>{city.split(",")[0]}</span>
                    </>
                  ) : null}
                </div>
                <button className={`mobile-filter-btn ${toolbarStyles.filterButton}`} onClick={() => setDrawerOpen(true)} type="button" aria-haspopup="dialog" aria-expanded={drawerOpen}>
                  Filters
                </button>
                <div className={`view-switch ${toolbarStyles.viewSwitch}`} role="group" aria-label="View mode">
                  {[
                    { value: "cards", label: "Cards", icon: "grid_view" },
                    { value: "list", label: "List", icon: "view_list" },
                    { value: "calendar", label: "Calendar", icon: "calendar_month" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-label={item.label}
                      aria-pressed={view === item.value}
                      className={view === item.value ? "active" : ""}
                      onClick={() => {
                        if (item.value === "calendar" && window.innerWidth <= 980) {
                          setMonthModalOpen(true);
                        } else {
                          setView(item.value);
                        }
                      }}
                    >
                      <span className={toolbarStyles.viewLabel}>{item.label}</span>
                      <span className={`material-icons ${toolbarStyles.viewIcon}`} aria-hidden="true">{item.icon}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="active-filters">
              {activeFilterChips.map((filter) => (
                <span key={filter.key} className="chip">
                  {filter.label}
                  <button type="button" onClick={filter.clear} aria-label={`Remove ${filter.label}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            <section className="dashboard">
              <div className="left-column">
                <div className="cards-grid">
                  {visible.length ? (
                    pageEvents.map(renderEventCard)
                  ) : (
                    <div className="empty">
                      <h3>No happenings found.</h3>
                      <p>Try another date, city, or category.</p>
                    </div>
                  )}
                </div>

                <div className="list-view">
                  {listGroups.length ? (
                    listGroups.map(([date, items]) => (
                      <div key={date} className="day-group">
                        <h3>{date === "sorted" ? "Happenings" : fmtLong(date)}</h3>
                        {items.map((event) => (
                          <Link key={event.id} className="list-row" href={`/events/${event.id}${selectedDate && event.recurrenceLabel ? `?date=${selectedDate}` : ""}`}>
                            <div className="list-time">{eventTimeLabelOn(event, date)}</div>
                            <div className="list-detail">
                              <strong>{event.title}</strong>
                              <span>
                                {event.venue} &middot; {event.cityLabel}
                              </span>
                            </div>
                            <div className="list-type">{event.type}</div>
                          </Link>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="empty">
                      <h3>No happenings found.</h3>
                      <p>Try another search or pick another date.</p>
                    </div>
                  )}
                </div>
                <nav className={toolbarStyles.mobilePagination} aria-label="Results pages">
                  <button type="button" disabled={currentPage <= 1} onClick={() => updateUrl({ page: currentPage - 1 })}>Previous</button>
                  <span aria-live="polite">Page {currentPage} of {pageCount}</span>
                  <button type="button" disabled={currentPage >= pageCount} onClick={() => updateUrl({ page: currentPage + 1 })}>Next</button>
                </nav>
              </div>

              <aside className="planner">
                <section className="panel">
                  <div className="calendar-head">
                    <div className="month-controls">
                      <button className="month-btn" onClick={() => shiftMonth(-1)} type="button" aria-label="Previous month">
                        ←
                      </button>
                      <div className="month-title">{monthTitle}</div>
                      <button className="month-btn" onClick={() => shiftMonth(1)} type="button" aria-label="Next month">
                        →
                      </button>
                    </div>
                    <div className="month-controls">
                      <button className="today-btn" onClick={goToday} type="button">
                        Today
                      </button>
                      <button className="month-modal-btn" onClick={() => setMonthModalOpen(true)} type="button">
                        View Month
                      </button>
                    </div>
                  </div>

                  <div className="legend">
                    {legendCategories.map((category) => {
                      const isActive = categoryFilter === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          className={`legend-chip${isActive ? " active" : ""}`}
                          onClick={() => {
                            const next = isActive ? "" : category;
                            updateUrl({ category: next });
                          }}
                        >
                          <i className="dot" style={{ backgroundColor: categoryColorMap.get(category) || CATEGORY_COLORS[0] }} />
                          <span>{displayCategory(category)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="calendar-grid desktop-grid">{renderCalendarGrid("desk")}</div>
                </section>

                <section className="panel">
                  <div className="agenda-head">
                    <div>
                      <div className="agenda-date">{selectedDate ? fmtLong(selectedDate) : "Pick a day"}</div>
                      <div className="agenda-meta">
                        {selectedDate ? `${agendaForSelected.length} event${agendaForSelected.length !== 1 ? "s" : ""}` : "Daily schedule"}
                      </div>
                    </div>
                    <button className="today-btn" type="button" onClick={() => setView("list")}>
                      View List
                    </button>
                  </div>
                  <div>
                    {agendaForSelected.length ? (
                      Object.entries(agendaBuckets)
                        .filter(([, items]) => items.length)
                        .map(([label, items]) => (
                          <div key={label} className="agenda-group">
                            <h4>{label}</h4>
                            {items.map((event) => (
                              <Link key={event.id} className="agenda-item" href={`/events/${event.id}${selectedDate && event.recurrenceLabel ? `?date=${selectedDate}` : ""}`}>
                                <div className="agenda-time">{eventTimeLabelOn(event, selectedDate)}</div>
                                <div className="agenda-detail">
                                  <strong>{event.title}</strong>
                                  <span>
                                    {event.venue} &middot; {event.type}
                                  </span>
                                </div>
                                <span className="agenda-save">View</span>
                              </Link>
                            ))}
                          </div>
                        ))
                    ) : (
                      <div className="empty">
                        <h3>{selectedDate ? "No happenings on this day." : "Choose a calendar date."}</h3>
                        <p>{selectedDate ? "Try another date or help locals find what is happening." : "Select a day above to see its happenings in time order."}</p>
                      </div>
                    )}
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </main>
      </div>

      <div className={`drawer${drawerOpen ? " open" : ""}`} onClick={(event) => event.target === event.currentTarget && setDrawerOpen(false)}>
        <div className="drawer-sheet">
          <div className="drawer-head">
            <div>
              <h4>Browse Filters</h4>
              <p>Choose a date or category, or reset the full happenings list.</p>
            </div>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)} type="button">
              ×
            </button>
          </div>
          <button className="all-events-filter" type="button" onClick={clearAllFilters}>
            <span className="material-icons" aria-hidden="true">event_available</span>
            <span><strong>All Happenings</strong><small>Clear every filter</small></span>
          </button>
          <div className="filter-section">
            <h5>Date</h5>
            <div className="filter-options">
              {DATE_FILTERS.map((filter) => (
                <button
                  key={filter.value || "all"}
                  className={dateFilter === filter.value ? "filter-option active" : "filter-option"}
                  type="button"
                  onClick={() => {
                    updateUrl({ date: filter.value });
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <h5>City</h5>
            <div className="filter-options">
              <button
                className={!city ? "filter-option active" : "filter-option"}
                type="button"
                onClick={() => selectCity("")}
              >
                All Cities
              </button>
              {cities.map((value) => (
                <button
                  key={value}
                  className={city === value ? "filter-option active" : "filter-option"}
                  type="button"
                  onClick={() => selectCity(value)}
                >
                  {value.replace(", TX", "")}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <h5>Category</h5>
            <div className="filter-options">
              <button
                className={!categoryFilter ? "filter-option active" : "filter-option"}
                type="button"
                onClick={() => {
                  updateUrl({ category: "" });
                }}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={categoryFilter === category ? "filter-option active" : "filter-option"}
                  type="button"
                  onClick={() => selectCategory(category)}
                >
                  {displayCategory(category)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`month-modal${monthModalOpen ? " open" : ""}`} onClick={(event) => event.target === event.currentTarget && setMonthModalOpen(false)}>
        <div className="month-sheet">
          <div className="drawer-head">
            <div className="modal-month-controls">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <span className="material-icons" aria-hidden="true">chevron_left</span>
              </button>
              <h4>{monthTitle}</h4>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                <span className="material-icons" aria-hidden="true">chevron_right</span>
              </button>
            </div>
            <button className="drawer-close" onClick={() => setMonthModalOpen(false)} type="button">
              ×
            </button>
          </div>
          <div className="legend">
            {legendCategories.map((category) => {
              const isActive = categoryFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  className={`legend-chip${isActive ? " active" : ""}`}
                  onClick={() => {
                    const next = isActive ? "" : category;
                    updateUrl({ category: next });
                  }}
                >
                  <i className="dot" style={{ backgroundColor: categoryColorMap.get(category) || CATEGORY_COLORS[0] }} />
                  <span>{displayCategory(category)}</span>
                </button>
              );
            })}
          </div>
          <div className="calendar-grid">{renderCalendarGrid("modal")}</div>
        </div>
      </div>

      <div
        className={`day-events-modal${dayModalDate ? " open" : ""}`}
        onClick={(event) => event.target === event.currentTarget && setDayModalDate("")}
      >
        <section className="day-events-sheet" role="dialog" aria-modal="true" aria-label={`Happenings on ${fmtLong(dayModalDate)}`}>
          <div className="drawer-head">
            <div>
              <h4>{fmtLong(dayModalDate)}</h4>
              <p>{dayModalEvents.length} happening{dayModalEvents.length === 1 ? "" : "s"}</p>
            </div>
            <button className="drawer-close" onClick={() => setDayModalDate("")} type="button" aria-label="Close day happenings">
              ×
            </button>
          </div>
          <div className="day-events-list">
            {dayModalEvents.length ? dayModalEvents.map((event) => (
              <Link
                key={event.id}
                className="day-event-link"
                href={`/events/${event.id}${event.recurrenceLabel ? `?date=${dayModalDate}` : ""}`}
              >
                <span className="day-event-time">{eventTimeLabelOn(event, dayModalDate)}</span>
                <span className="day-event-copy">
                  <strong>{event.title}</strong>
                  <small>{event.venue} &middot; {event.cityLabel}</small>
                </span>
                <span className="material-icons" aria-hidden="true">arrow_forward</span>
              </Link>
            )) : (
              <div className="empty">
                <h3>No happenings on this day.</h3>
                <p>Choose another date to keep browsing.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <nav className="bottom-nav" aria-label="Mobile event navigation">
        {[
          { action: "businesses", icon: "storefront", label: "Business" },
          { action: "calendar", icon: "calendar_month", label: "Calendar" },
          { action: "filters", icon: "tune", label: "Filters" },
          { action: "saved", icon: "bookmark", label: "Saved" },
          { action: "account", icon: isLoggedIn ? "dashboard" : "login", label: isLoggedIn ? "Dashboard" : "Login" },
        ].map(({ action, icon, label }) => (
          <button
            key={action}
            className={action === "saved" && savedOnly ? "active" : ""}
            onClick={() => handleBottomNav(action)}
            type="button"
          >
            <span className="material-icons ico" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
