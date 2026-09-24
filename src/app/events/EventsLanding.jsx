"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import DirectoryImage from "@/components/DirectoryImage";
import EventSearchBar from "@/components/EventSearchBar/EventSearchBar";
import { LikeCount } from "@/components/LikeCount";
import NavbarMobileMenu from "@/components/Navbar/NavbarMobileMenu";

import "./events-landing.css";

const FEATURED_CATEGORIES = [
  "Live Music",
  "Food & Drink",
  "Markets",
  "Outdoor",
  "Free Events",
];

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

function EventCard({ event, index, isLoggedIn }) {
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
        {event.imageUrl ? (
          <div className="event-photo real-photo">
            <DirectoryImage src={event.imageUrl} alt="" sizes="(max-width: 560px) 100vw, (max-width: 1050px) 50vw, 25vw" />
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
          {event.dateKeys?.length > 1 ? (
            <>
              {event.shortDateRangeLabel}
              <br />
            </>
          ) : null}
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
          <LikeCount
            count={event.likesCount ?? 0}
            size="sm"
            targetType="event"
            targetId={event.id}
            targetName={event.title}
            initialLiked={Boolean(event.isLiked)}
            isLoggedIn={isLoggedIn}
          />
          <Link className="heart" href={`/events/${event.id}`} aria-label={`View ${event.title}`}>
            &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function EventsLanding({
  events = [],
  cities = [],
  categories = [],
  isLoggedIn = false,
  dashboardPath = "/dashboard",
}) {
  const trendingEvents = useMemo(() => events.slice(0, 4), [events]);
  const activeCategories = categories.length ? categories : FEATURED_CATEGORIES;

  return (
    <div className="events-landing">
      <div className="page">
        <header className="site-header">
          <div className="container nav">
            <Logo />
            <nav className="nav-links" aria-label="Main navigation">
              <Link href="/results">Businesses</Link>
              <Link href="/about">About</Link>
              <Link href="/post-your-business">Add Listing</Link>
            </nav>
            <Link href={isLoggedIn ? dashboardPath : "/login"} className="login-btn">
              {isLoggedIn ? "Dashboard" : "Login"}
            </Link>
            <div className="mobile-nav-menu">
              <NavbarMobileMenu
                theme="dark"
                links={[
                  { href: "/", label: "Home" },
                  { href: "/results", label: "Businesses" },
                  { href: "/events", label: "Happenings" },
                  { href: "/about", label: "About" },
                  { href: "/post-your-business", label: "Add Listing" },
                ]}
                activeHref="/events"
                pillHref={isLoggedIn ? dashboardPath : "/login"}
                pillLabel={isLoggedIn ? "Dashboard" : "Login"}
              />
            </div>
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
                Live music, local happenings, and weekend plans
                <br />
                without the noise.
              </p>

              <EventSearchBar
                initialLocation={cities[0] || "Austin, TX"}
                initialDate="this-weekend"
              />

              <div className="chips" aria-label="Popular happening filters">
                {["Live Music", "This Weekend", "Free Events", "Outdoor", "Markets", "Family Friendly", "Nightlife"].map((chip) => {
                  const params = new URLSearchParams();
                  if (chip === "This Weekend") params.set("date", "this-weekend");
                  else params.set("category", chip.replace(" Friendly", ""));
                  return (
                    <Link key={chip} className="chip" href={`/events/results?${params.toString()}`}>
                      <b>*</b> {chip === "Free Events" ? "Free Happenings" : chip}
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
                    <EventCard
                      key={event.id}
                      event={event}
                      index={index}
                      isLoggedIn={isLoggedIn}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No published happenings yet.</h3>
                  <p>Approved happenings will appear here automatically as locals add them.</p>
                  <Link href="/dashboard/events/new" className="primary-btn">
                    Add a Happening
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
                    <h3>{category === "Free Events" ? "Free Happenings" : category}</h3>
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
                  ["2", "Find the Spot", "Browse approved local happenings without sponsored clutter."],
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
                  <p className="cta-copy">No ads. No sponsored happenings. Just local.</p>
                  <Link href="/events/results" className="primary-btn">
                    See Happenings Near You &rarr;
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
