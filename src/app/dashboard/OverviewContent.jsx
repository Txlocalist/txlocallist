import Image from "next/image";
import Link from "next/link";

import ambassadorImage from "@/app/assets/Ambasodor.png";

import styles from "./overview.module.css";

export function OverviewContent({
  canCreateListing,
  greetingName,
  recentBusinesses,
  schemaNotice,
  stats,
  subtitle,
}) {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroIntro}>
          <p className={styles.eyebrow}>Dashboard Overview</p>
          <h1 className={styles.title}>Howdy, {greetingName}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </section>

      {schemaNotice && (
        <div className={styles.emptyPanel}>
          {schemaNotice} Run the Phase 3 Prisma schema sync, then refresh the dashboard.
        </div>
      )}

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

      <section className={styles.featurePanel}>
        <div className={styles.featureContent}>
          <p className={styles.featureBadge}>Texas spotlight</p>
          <h2 className={styles.featureTitle}>Join the Localist Ambassador Circle</h2>
          <p className={styles.featureDescription}>
            Become a top-tier business partner and get featured in our monthly print editorial sent to 50,000 households.
          </p>

          <Link href="/pricing" className={styles.featurePrimary}>
            Learn More
            <span className="material-icons" aria-hidden="true">
              star_outline
            </span>
          </Link>
        </div>

        <div className={styles.featureMedia}>
          <Image
            src={ambassadorImage}
            alt="Ambassador spotlight sign"
            className={styles.ambassadorImage}
            sizes="(max-width: 920px) 100vw, 42vw"
            priority
          />
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
