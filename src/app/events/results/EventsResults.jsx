"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getBlobImageUrl } from "@/lib/blob";

import "./events-results.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
    return new Set(Array.from({ length: 8 }, (_, index) => keyFromDate(addDays(today, index))));
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

      if (keys && !keys.has(event.dateKey)) return false;

      return true;
    })
    .sort((a, b) => eventDate(a) - eventDate(b) || String(a.timeLabel).localeCompare(String(b.timeLabel)));
}

function timeBucket(event) {
  if (!event.startDate) return "Tonight";
  const hour = new Date(event.startDate).getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Tonight";
}

function Logo({ mobile = false }) {
  return (
    <Link href="/events" className={mobile ? "brand-image mobile" : "brand-image"} aria-label="Texas Localist events">
      <Image src="/Dark-mode-logo.svg" alt="Texas Localist" width={mobile ? 170 : 224} height={mobile ? 82 : 108} priority />
    </Link>
  );
}

function EventThumb({ event }) {
  const imageUrl = event.imageUrl ? getBlobImageUrl(event.imageUrl) : "";
  if (imageUrl) {
    return (
      <div className="thumb real-thumb">
        {/* Blob URLs can be proxied or supplied by users, so this needs a plain image element. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" />
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
  initialFilters = {},
}) {
  const router = useRouter();
  const leftColumnRef = useRef(null);

  const [view, setView] = useState("cards");
  const [query, setQuery] = useState(initialFilters.query || "");
  const [cityInput, setCityInput] = useState(initialFilters.location || "");
  const [city, setCity] = useState(initialFilters.location || "");
  const [dateFilter, setDateFilter] = useState(initialFilters.date || "");
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || "");
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [accordions, setAccordions] = useState({ citiesNav: true, catsNav: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [monthModalOpen, setMonthModalOpen] = useState(false);

  const filtered = useMemo(
    () => filterEvents(allEvents, { query, city, category: categoryFilter, date: dateFilter }),
    [allEvents, query, city, categoryFilter, dateFilter]
  );

  const firstVisibleDate = filtered.find((event) => event.dateKey && event.dateKey !== "undated")?.dateKey;
  const [selectedDate, setSelectedDate] = useState(firstVisibleDate || "");
  const [month, setMonth] = useState(() => {
    const date = dateObj(firstVisibleDate) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedDate && !filtered.some((event) => event.dateKey === selectedDate)) {
      const next = filtered.find((event) => event.dateKey && event.dateKey !== "undated")?.dateKey || "";
      setSelectedDate(next);
      const date = dateObj(next);
      if (date) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [filtered, selectedDate]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setDrawerOpen(false);
        setMonthModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () => (selectedDate ? filtered.filter((event) => event.dateKey === selectedDate) : filtered),
    [filtered, selectedDate]
  );

  const calendarCounts = useMemo(() => {
    const counts = {};
    filtered.forEach((event) => {
      if (!event.dateKey || event.dateKey === "undated") return;
      (counts[event.dateKey] ||= []).push(event);
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
    () => filtered.filter((event) => event.dateKey === selectedDate),
    [filtered, selectedDate]
  );

  const agendaBuckets = useMemo(() => {
    const buckets = { Morning: [], Afternoon: [], Tonight: [] };
    agendaForSelected.forEach((event) => buckets[timeBucket(event)].push(event));
    return buckets;
  }, [agendaForSelected]);

  const listGroups = useMemo(() => {
    const grouped = {};
    visible.forEach((event) => {
      const key = event.dateKey || "undated";
      (grouped[key] ||= []).push(event);
    });
    return Object.entries(grouped);
  }, [visible]);

  const selectedDateObj = dateObj(selectedDate);
  const monthTitle = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

  function updateUrl(next = {}) {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? query;
    const nextCity = next.city ?? city;
    const nextDate = next.date ?? dateFilter;
    const nextCategory = next.category ?? categoryFilter;
    if (nextQuery) params.set("q", nextQuery);
    if (nextCity) params.set("loc", nextCity);
    if (nextDate) params.set("date", nextDate);
    if (nextCategory) params.set("category", nextCategory);
    router.replace(params.toString() ? `/events/results?${params.toString()}` : "/events/results", {
      scroll: false,
    });
  }

  const activeFilterChips = [
    city
      ? {
          key: "city",
          label: city,
          clear: () => {
            setCity("");
            setCityInput("");
            updateUrl({ city: "" });
          },
        }
      : null,
    dateFilter
      ? {
          key: "date",
          label: DATE_FILTERS.find((item) => item.value === dateFilter)?.label || dateFilter,
          clear: () => {
            setDateFilter("");
            updateUrl({ date: "" });
          },
        }
      : null,
    categoryFilter
      ? {
          key: "category",
          label: categoryFilter,
          clear: () => {
            setCategoryFilter("");
            updateUrl({ category: "" });
          },
        }
      : null,
  ].filter(Boolean);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setCity(cityInput.trim());
    updateUrl({ city: cityInput.trim() });
  }

  function selectCity(value) {
    setCity(value);
    setCityInput(value);
    updateUrl({ city: value });
    if (window.innerWidth <= 980) setSidebarOpen(false);
  }

  function selectCategory(value) {
    setCategoryFilter(value);
    updateUrl({ category: value });
    if (window.innerWidth <= 980) setSidebarOpen(false);
  }

  function selectDay(key) {
    setSelectedDate(key);
    leftColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.innerWidth <= 980) setMonthModalOpen(false);
  }

  function shiftMonth(delta) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function goToday() {
    const today = dateObj(todayKey()) || new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(keyFromDate(today));
  }

  function toggleSave(id) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBottomNav(action) {
    if (action === "events") setView("cards");
    if (action === "calendar") setView("calendar");
    if (action === "filters") setDrawerOpen(true);
    if (action === "saved") setView("cards");
    if (action === "login") router.push("/login");
  }

  function showAllEvents() {
    setSelectedDate("");
    setView("list");
    if (typeof window !== "undefined" && window.innerWidth <= 980) {
      setSidebarOpen(false);
    }
  }

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
              aria-label={`${fmtLong(cell.key)}${cell.count ? `, ${cell.count} events` : ", no events"}`}
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
    const isSaved = savedIds.has(event.id);
    return (
      <article key={event.id} className="event-card">
        <Link
          href={`/events/${event.id}`}
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
          <div className="time">{event.timeLabel}</div>
        </div>
        <EventThumb event={event} />
        <div className="card-body">
          <span className="card-tag">{event.type}</span>
          <h2 className="card-title">
            {event.title}
            <small>{event.venue}</small>
          </h2>
          <div className="card-meta">
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
            <button className={`tiny-btn${isSaved ? " saved" : ""}`} onClick={() => toggleSave(event.id)}>
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className={`events-results view-${view}`}>
      <div className="mobile-top">
        <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
          ☰
        </button>
        <Logo mobile />
        <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open filters">
          ◇
        </button>
      </div>

      <div className={`sidebar-overlay${sidebarOpen ? " show" : ""}`} onClick={() => setSidebarOpen(false)} />

      <div className="app">
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <Logo />

          <div className="nav-stack">
            <button className="nav-item active" type="button" onClick={showAllEvents}>
              <span className="icon-bubble">□</span>
              <span className="grow">All Events</span>
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
                    {value}
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
            <Link className="login-btn" href="/login">
              Login
            </Link>
          </div>

          <div className="side-divider" />

          <button className="browse-item" onClick={() => { setDateFilter(""); updateUrl({ date: "" }); }}>
            <span className="browse-bubble bubble-new">NEW</span> <span>All Dates</span>
          </button>
          <button className="browse-item" onClick={() => { setDateFilter("next-7-days"); updateUrl({ date: "next-7-days" }); }}>
            <span className="browse-bubble bubble-save">*</span> <span>Next 7 Days</span>
          </button>
          <button className="browse-item" onClick={() => setView("cards")}>
            <span className="browse-bubble bubble-fav">♥</span> <span>Saved View</span>
          </button>

          <div className="side-footer">
            &copy; 2026 Texas Localist.
            <br />
            Handcrafted in the Lone Star State.
          </div>
        </aside>

        <main className="main">
          <div className="container">
            <form className="search-bar" onSubmit={handleSearchSubmit}>
              <label className="field">
                Search
                <input
                  type="text"
                  placeholder="Search artists, venues, festivals or towns..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="field">
                City
                <input type="text" value={cityInput} onChange={(event) => setCityInput(event.target.value)} />
              </label>
              <label className="field">
                Date
                <select
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value);
                    updateUrl({ date: event.target.value });
                  }}
                >
                  {DATE_FILTERS.map((filter) => (
                    <option key={filter.value || "all"} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="search-btn" type="submit">
                Search
              </button>
            </form>

            <div className="top-actions">
              <div>
                <div className="eyebrow">Events &amp; Live Music</div>
                <h1 className="headline">
                  Find what&apos;s <span className="highlight">happening.</span>
                </h1>
                <p className="subcopy">
                  Browse local shows, markets, food events and nights out, then jump into a calendar
                  that helps you see what is going on by day.
                </p>
              </div>
              <div className="view-tools">
                <div className="summary-pill">
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
                <div className="view-switch">
                  {[
                    { value: "cards", label: "Cards" },
                    { value: "list", label: "List" },
                    { value: "calendar", label: "Calendar" },
                  ].map((item) => (
                    <button key={item.value} type="button" className={view === item.value ? "active" : ""} onClick={() => setView(item.value)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <button className="mobile-filter-btn" onClick={() => setDrawerOpen(true)} type="button">
                  Filters
                </button>
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
              <div className="left-column" ref={leftColumnRef}>
                <div className="cards-grid">
                  {visible.length ? (
                    visible.map(renderEventCard)
                  ) : (
                    <div className="empty">
                      <h3>No events found.</h3>
                      <p>Try another date, city, or category.</p>
                    </div>
                  )}
                </div>

                <div className="list-view">
                  {listGroups.length ? (
                    listGroups.map(([date, items]) => (
                      <div key={date} className="day-group">
                        <h3>{fmtLong(date)}</h3>
                        {items.map((event) => (
                          <Link key={event.id} className="list-row" href={`/events/${event.id}`}>
                            <div className="list-time">{event.timeLabel}</div>
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
                      <h3>No events found.</h3>
                      <p>Try another search or pick another date.</p>
                    </div>
                  )}
                </div>
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
                            setCategoryFilter(next);
                            updateUrl({ category: next });
                          }}
                        >
                          <i className="dot" style={{ backgroundColor: categoryColorMap.get(category) || CATEGORY_COLORS[0] }} />
                          <span>{category}</span>
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
                        {`${agendaForSelected.length} event${agendaForSelected.length !== 1 ? "s" : ""}`}
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
                              <Link key={event.id} className="agenda-item" href={`/events/${event.id}`}>
                                <div className="agenda-time">{event.timeLabel}</div>
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
                        <h3>Nothing on the calendar yet.</h3>
                        <p>Try another date or help locals find what is happening.</p>
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
            <h4>Browse Filters</h4>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)} type="button">
              ×
            </button>
          </div>
          <div className="nav-stack">
            {DATE_FILTERS.filter((filter) => filter.value).map((filter) => (
              <button
                key={filter.value}
                className="nav-item"
                type="button"
                onClick={() => {
                  setDateFilter(filter.value);
                  updateUrl({ date: filter.value });
                  setDrawerOpen(false);
                }}
              >
                <span className="icon-bubble">*</span>
                <span className="grow">{filter.label}</span>
              </button>
            ))}
            {categories.map((category) => (
              <button key={category} className="nav-item" type="button" onClick={() => { selectCategory(category); setDrawerOpen(false); }}>
                <span className="icon-bubble">◇</span>
                <span className="grow">{category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`month-modal${monthModalOpen ? " open" : ""}`} onClick={(event) => event.target === event.currentTarget && setMonthModalOpen(false)}>
        <div className="month-sheet">
          <div className="drawer-head">
            <h4>{monthTitle}</h4>
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
                    setCategoryFilter(next);
                    updateUrl({ category: next });
                  }}
                >
                  <i className="dot" style={{ backgroundColor: categoryColorMap.get(category) || CATEGORY_COLORS[0] }} />
                  <span>{category}</span>
                </button>
              );
            })}
          </div>
          <div className="calendar-grid">{renderCalendarGrid("modal")}</div>
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Mobile event navigation">
        {[
          { action: "events", icon: "□", label: "Events" },
          { action: "calendar", icon: "▦", label: "Calendar" },
          { action: "filters", icon: "◇", label: "Filters" },
          { action: "saved", icon: "♥", label: "Saved" },
          { action: "login", icon: "→", label: "Login" },
        ].map(({ action, icon, label }) => (
          <button key={action} onClick={() => handleBottomNav(action)} type="button">
            <span className="ico">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
