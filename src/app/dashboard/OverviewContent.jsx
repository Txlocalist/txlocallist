import Link from "next/link";
import EventEditLink, { canEditHappening } from "./events/EventEditLink";
import { formatEventDateRange } from "@/lib/event-dates";
import { getNextEventOccurrence } from "@/lib/event-recurrence";

import styles from "./overview.module.css";

export function OverviewContent({
  canCreateListing,
  greetingName,
  recentBusinesses,
  recentEvents = [],
  eventsUnavailable = false,
  stats,
  subtitle,
}) {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <p className={styles.eyebrow}>Dashboard Overview</p>
          <h1 className={styles.title}>Howdy, {greetingName}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
      </section>

      <section className={styles.metricsGrid}>
        <MetricCard
          label="My Listings"
          value={stats.total}
          href="/dashboard/businesses"
          linkLabel="View listings"
          toneClass={styles.metricCream}
        />
        <MetricCard
          label="Active Now"
          value={stats.active}
          href="/dashboard/businesses?status=ACTIVE"
          linkLabel="See active"
          toneClass={styles.metricOrange}
        />
        <MetricCard
          label="Paid Plans"
          value={stats.paidPlans}
          href="/dashboard/billing"
          linkLabel="Manage billing"
          toneClass={styles.metricTeal}
        />
        <MetricCard
          label="Draft Listings"
          value={stats.draft}
          href="/dashboard/businesses?status=DRAFT"
          linkLabel="Finish drafts"
          toneClass={styles.metricDark}
        />
      </section>

      <section className={styles.lowerGrid}>
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Happenings</h2>
            <Link href="/dashboard/events" className={styles.sectionLink}>
              Manage all happenings
            </Link>
          </div>
          <p className={styles.sectionDescription}>
            Update your event details and cover photo. Published happenings stay live when you save.
          </p>
          {recentEvents.length > 0 ? (
            <div className={styles.listingList}>
              {recentEvents.map((event) => {
                const occurrence = getNextEventOccurrence(event) || event;
                const status = event.status === "PUBLISHED" && event.postingMethod !== "ONE_TIME"
                  && (!canCreateListing || (event.business && event.business.status !== "ACTIVE"))
                  ? "SUSPENDED" : event.status;
                return (
                  <div key={event.id} className={styles.listingItem}>
                    <div>
                      <h3 className={styles.listingName}>{event.title}</h3>
                      <p className={styles.listingMeta}>
                        {event.city} · {formatEventDateRange(occurrence.startDate, occurrence.endDate, event.timezone, { compact: true })}
                      </p>
                      <span className={`${styles.listingStatus} ${styles[`status${status}`] || styles.statusPAUSED}`}>
                        {status}
                      </span>
                    </div>
                    {canEditHappening(event, canCreateListing) ? (
                      <EventEditLink event={event} hasCreatorAccess={canCreateListing} className={styles.eventEditAction} />
                    ) : (
                      <Link href="/dashboard/events" className={styles.listingAction}>Manage happening</Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.inlineEmptyPanel}>
              {eventsUnavailable ? "Happenings are temporarily unavailable." : (
                <>No happenings yet. <Link href="/dashboard/events/new" className={styles.sectionLink}>Post your first happening</Link>.</>
              )}
            </div>
          )}
        </div>
        <div
          className={`${styles.sectionCard} ${
            recentBusinesses.length > 0 ? styles.listingSectionFilled : styles.listingSectionCompact
          }`}
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Listings</h2>
            <Link href="/dashboard/businesses" className={styles.sectionLink}>
              View all
            </Link>
          </div>

          {recentBusinesses.length > 0 ? (
            <div className={styles.listingList}>
              {recentBusinesses.map((business) => (
                <div key={business.id} className={styles.listingItem}>
                  <div>
                    <h3 className={styles.listingName}>{business.name}</h3>
                    <p className={styles.listingMeta}>{business.city.name}</p>
                    <span className={`${styles.listingStatus} ${styles[`status${business.status}`]}`}>
                      {business.status}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/businesses/${business.id}/edit`}
                    className={styles.listingAction}
                  >
                    Edit
                    <span className="material-icons" aria-hidden="true">
                      east
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.inlineEmptyPanel}>
              {canCreateListing
                ? "No listings yet. Create your first one to start showing up in local discovery."
                : "No listings yet. Upgrade your account in billing before creating your first listing."}
            </div>
          )}
        </div>
      </section>

    </>
  );
}

function MetricCard({ label, value, href, linkLabel, toneClass }) {
  return (
    <div className={`${styles.metricCard} ${toneClass}`}>
      <div>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
      </div>
      <Link href={href} className={styles.metricLink}>
        {linkLabel}
        <span className="material-icons" aria-hidden="true">
          east
        </span>
      </Link>
    </div>
  );
}

function QuickActionCard({ title, description, href }) {
  return (
    <Link href={href} className={styles.quickAction}>
      <h3 className={styles.quickActionTitle}>{title}</h3>
      <p className={styles.quickActionDescription}>{description}</p>
      <span className={styles.quickActionArrow}>Open →</span>
    </Link>
  );
}
