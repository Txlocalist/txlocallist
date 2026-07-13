"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getBlobImageUrl } from "@/lib/blob";

import "./events-landing.css";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEATURED_CATEGORIES = [
  "Live Music",
  "Food & Drink",
  "Markets",
  "Outdoor",
  "Free Events",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function iso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nice(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateFromKey(key) {
  if (!key || key === "undated") return null;
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function eventMonth(event) {
  const date = dateFromKey(event.dateKey);
  return date ? date.toLocaleDateString(undefined, { month: "short" }).toUpperCase() : "TBD";
}

function eventWeekday(event) {
  const date = dateFromKey(event.dateKey);
  return date ? date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() : "DATE";
}

function eventDay(event) {
  const date = dateFromKey(event.dateKey);
  return date ? String(date.getDate()) : "--";
}

function ticketTone(index) {
  return ["", "teal", "", "yellow"][index % 4];
}

function photoTone(event) {
  const text = [event.type, ...(event.tags || [])].join(" ").toLowerCase();
  if (text.includes("market") || text.includes("food") || text.includes("drink")) return "market";
  if (text.includes("jazz")) return "jazz";
  if (text.includes("outdoor") || text.includes("family")) return "sunset";
  return "band";
}

function Logo({ compact = false }) {
  return (
    <Link href="/" className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Texas Localist home">
      <Image src="/Dark-mode-logo.svg" alt="Texas Localist" width={compact ? 154 : 226} height={compact ? 74 : 108} priority />
    </Link>
  );
}

function EventCard({ event, index }) {
  const imageUrl = event.imageUrl ? getBlobImageUrl(event.imageUrl) : "";

  return (
    <article className="event-card">
      <div className="event-top">
        <div className={`date-badge ${ticketTone(index)}`}>
          <span className="month">
            {eventWeekday(event)}
            <br />
            {eventMonth(event)}
          </span>
          <span className="day">{eventDay(event)}</span>
          <span className="time">{event.timeLabel}</span>
        </div>
        {imageUrl ? (
          <div className="event-photo real-photo">
            <img src={imageUrl} alt="" />
          </div>
        ) : (
          <div className={`event-photo ${photoTone(event)}`} />
        )}
      </div>
      <div className="event-body">
        <span className="tag teal">{event.type}</span>
        <h3 className="event-title">
          <Link href={`/events/${event.id}`}>{event.title}</Link>
        </h3>
        <p className="meta">
          {event.venue}
          <br />
          {event.cityLabel}
        </p>
        <div className="event-bottom">
          <div className="mini-tags">
            {(event.tags || []).slice(0, 2).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
          <Link className="heart" href={`/events/${event.id}`} aria-label={`View ${event.title}`}>
            &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function EventsLanding({ events = [], cities = [], categories = [] }) {
  const router = useRouter();
  const popoverRef = useRef(null);
  const dateWrapRef = useRef(null);

  const [query, setQuery] = useState("");
  const [city, setCity] = useState(() => cities[0] || "Austin, TX");
  const [dateLabel, setDateLabel] = useState("This Weekend");
  const [dateValue, setDateValue] = useState("this-weekend");
  const [activePreset, setActivePreset] = useState("this-weekend");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [today] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!popoverOpen) return undefined;
    function onClick(event) {
      if (
        !popoverRef.current?.contains(event.target) &&
        !dateWrapRef.current?.contains(event.target)
      ) {
        setPopoverOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  const calendarCells = useMemo(() => {
    if (!viewDate) return [];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push({ key: `blank-${i}`, blank: true });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(year, month, day);
      cells.push({
        key: iso(current),
        day,
        date: current,
        isToday: sameDay(current, today),
        isSelected: sameDay(current, selectedDate),
      });
    }
    return cells;
  }, [viewDate, today, selectedDate]);

  const trendingEvents = useMemo(() => events.slice(0, 4), [events]);
  const activeCategories = categories.length ? categories : FEATURED_CATEGORIES;
  const calMonthLabel = viewDate
    ? viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  function applyPreset(preset, label, value) {
    setActivePreset(preset);
    setDateLabel(label);
    setDateValue(value);
  }

  function handleQuickDate(preset) {
    if (!today) return;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (preset === "today") {
      setSelectedDate(today);
      applyPreset(preset, "Today", iso(today));
      setPopoverOpen(false);
    } else if (preset === "tomorrow") {
      setSelectedDate(tomorrow);
      applyPreset(preset, "Tomorrow", iso(tomorrow));
      setPopoverOpen(false);
    } else if (preset === "this-weekend") {
      setSelectedDate(null);
      applyPreset(preset, "This Weekend", "this-weekend");
      setPopoverOpen(false);
    } else if (preset === "custom") {
      setActivePreset("custom");
      setPopoverOpen(true);
    }
  }

  function handleDayClick(cell) {
    setSelectedDate(cell.date);
    applyPreset("custom", nice(cell.date), iso(cell.date));
    setPopoverOpen(false);
  }

  function shiftMonth(delta) {
    setViewDate((prev) =>
      prev ? new Date(prev.getFullYear(), prev.getMonth() + delta, 1) : prev
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set("loc", city.trim());
    if (dateValue) params.set("date", dateValue);
    router.push(`/events/results?${params.toString()}`);
  }

  return (
    <div className="events-landing">
      <div className="page">
        <header className="site-header">
          <div className="container nav">
            <Logo />
            <nav className="nav-links" aria-label="Main navigation">
              <Link href="/results">Explore</Link>
              <a href="#how">How It Works</a>
              <Link href="/about">About</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/post-your-business">Add Listing</Link>
            </nav>
            <Link href="/login" className="login-btn">
              Login
            </Link>
          </div>
        </header>

        <main>
          <section className="hero" aria-labelledby="page-title">
            <div className="stars" />
            <div className="string-lights">
              <span className="bulbs" />
            </div>
            <div className="hero-left-art">
              <div className="neon-box" />
              <div className="guitar-line" />
            </div>
            <div className="hero-right-art">
              <div className="capitol-line" />
            </div>

            <div className="container hero-content">
              <h1 className="headline" id="page-title">
                Find what&apos;s{" "}
                <span>
                  happening.<em className="star">*</em>
                </span>
              </h1>
              <p className="hero-sub">
                Live music, local events, and weekend plans
                <br />
                without the noise.
              </p>

              <form className="search-shell" onSubmit={handleSubmit} aria-label="Search local events">
                <label className="search-field">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <circle cx="10" cy="10" r="7" />
                    <path d="m15 15 5 5" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search bands, venues, festivals..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                  <input aria-label="City" value={city} onChange={(event) => setCity(event.target.value)} />
                </label>
                <div className="search-field date-wrap" ref={dateWrapRef}>
                  <span className="event-mode-pill">
                    <b>□</b> Local Events
                  </span>
                  <button
                    className="date-trigger"
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={popoverOpen}
                    onClick={() => setPopoverOpen((open) => !open)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <rect x="4" y="5" width="16" height="15" rx="2" />
                      <path d="M8 3v4M16 3v4M4 10h16" />
                    </svg>
                    <span>{dateLabel}</span>
                  </button>
                  <div
                    className={`date-popover${popoverOpen ? " open" : ""}`}
                    role="dialog"
                    aria-label="Choose event date"
                    ref={popoverRef}
                  >
                    <div className="quick-dates" aria-label="Quick date choices">
                      {[
                        { preset: "today", label: "Today" },
                        { preset: "tomorrow", label: "Tomorrow" },
                        { preset: "this-weekend", label: "This Weekend" },
                        { preset: "custom", label: "Pick a Date" },
                      ].map(({ preset, label }) => (
                        <button
                          key={preset}
                          type="button"
                          className={`quick-date${activePreset === preset ? " active" : ""}`}
                          onClick={() => handleQuickDate(preset)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mini-cal">
                      <div className="cal-head">
                        <button type="button" className="cal-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                          &lsaquo;
                        </button>
                        <span>{calMonthLabel}</span>
                        <button type="button" className="cal-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
                          &rsaquo;
                        </button>
                      </div>
                      <div className="cal-grid">
                        {DAY_NAMES.map((name) => (
                          <div key={name} className="cal-day-name">
                            {name}
                          </div>
                        ))}
                        {calendarCells.map((cell) =>
                          cell.blank ? (
                            <button key={cell.key} type="button" className="cal-day muted" tabIndex={-1} />
                          ) : (
                            <button
                              key={cell.key}
                              type="button"
                              className={`cal-day${cell.isToday ? " today" : ""}${cell.isSelected ? " selected" : ""}`}
                              onClick={() => handleDayClick(cell)}
                            >
                              {cell.day}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <p className="date-note">Choose a quick window or pick an exact date.</p>
                  </div>
                </div>
                <button className="search-btn" type="submit">
                  Search
                </button>
              </form>

              <div className="chips" aria-label="Popular event filters">
                {["Live Music", "This Weekend", "Free Events", "Outdoor", "Markets", "Family Friendly", "Nightlife"].map((chip) => {
                  const params = new URLSearchParams();
                  if (chip === "This Weekend") params.set("date", "this-weekend");
                  else params.set("category", chip.replace(" Friendly", ""));
                  return (
                    <Link key={chip} className="chip" href={`/events/results?${params.toString()}`}>
                      <b>*</b> {chip}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2 className="section-title">
                  Trending
                  <br />
                  <span className="red">This Weekend</span> <span className="teal">*</span>
                </h2>
                <Link href="/events/results" className="section-link">
                  View Full Calendar &rarr;
                </Link>
              </div>

              {trendingEvents.length ? (
                <div className="event-grid">
                  {trendingEvents.map((event, index) => (
                    <EventCard key={event.id} event={event} index={index} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No published events yet.</h3>
                  <p>Approved events will appear here automatically as locals add them.</p>
                  <Link href="/dashboard/events/new" className="primary-btn">
                    Add an Event
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="section vibe-section">
            <div className="container">
              <div className="section-header">
                <h2 className="section-title">
                  Browse by <span className="teal">Vibe</span> <span className="teal">*</span>
                </h2>
                <Link href="/events/results" className="section-link">
                  Explore All Categories &rarr;
                </Link>
              </div>
              <div className="vibe-grid">
                {activeCategories.slice(0, 5).map((category) => (
                  <Link key={category} href={`/events/results?category=${encodeURIComponent(category)}`} className="vibe-card">
                    <div className="vibe-img" />
                    <div className="vibe-icon">*</div>
                    <h3>{category}</h3>
                    <p>Find local plans, venues, and happenings in this lane.</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="steps" id="how">
            <div className="container">
              <h2 className="section-title">
                How it <span className="red">Works.</span> <span className="teal">*</span>
              </h2>
              <div className="step-grid">
                {[
                  ["1", "Pick a Vibe", "Choose what you are in the mood for from local categories."],
                  ["2", "Find the Spot", "Browse approved local events without sponsored clutter."],
                  ["3", "Support Local", "Head out and keep the Texas spirit alive and well."],
                ].map(([number, title, copy]) => (
                  <article key={number} className="step">
                    <div className="step-num">{number}</div>
                    <div>
                      <h3>{title}</h3>
                      <p>{copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="cta-wrap">
            <div className="container">
              <div className="cta-band">
                <div>
                  <h2 className="cta-title">
                    Skip the <span>Noise.</span>
                  </h2>
                  <p className="cta-copy">No ads. No sponsored events. Just local.</p>
                  <Link href="/events/results" className="primary-btn">
                    See Events Near You &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="container">
            <div className="footer-row">
              <Logo compact />
              <nav className="footer-links" aria-label="Footer navigation">
                <Link href="/about">About</Link>
                <a href="#how">How It Works</a>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/contact">Contact</Link>
              </nav>
            </div>
            <p className="copyright">
              &copy; 2026 Texas Localist. All rights reserved. Handcrafted in the Lone Star State.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
