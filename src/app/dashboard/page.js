import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "./DashboardShell";
import { OverviewContent } from "./OverviewContent";
import styles from "./overview.module.css";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

function titleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Main dashboard overview page.
 * Shows stats, recent listings, and quick actions.
 */
export default async function DashboardPage() {
  // Get current user from session
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;

  const billingState = await getOwnerBillingState(user.id).catch(() => null);
  const canCreateListing = user.role === "ADMIN" || Boolean(billingState?.hasPaidAccess);

  if (!canCreateListing) {
    redirect("/dashboard/favorites");
  }

  let businesses = [];
  let schemaNotice = null;

  try {
    businesses = await prisma.business.findMany({
      where: { ownerId: user.id },
      include: {
        city: true,
        plan: true,
        subscription: true,
        photos: true,
        categories: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    schemaNotice = phase3SchemaMessage;
  }

  const stats = {
    total: businesses.length,
    active: businesses.filter((b) => b.status === "ACTIVE").length,
    draft: businesses.filter((b) => b.status === "DRAFT").length,
    paused: businesses.filter((b) => b.status === "PAUSED").length,
    paidPlans: businesses.filter((b) => b.plan?.slug && b.plan.slug !== "free").length,
  };

  const recentBusinesses = businesses.slice(0, 5);
  const firstBusinessName = businesses[0]?.name ?? null;
  const firstNameFromEmail = user.email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "neighbor";
  const greetingName = firstBusinessName || titleCase(firstNameFromEmail);
  const subtitle =
    businesses.length > 0
      ? `Your profile is shining bright. You currently have ${stats.active} active listing${stats.active === 1 ? "" : "s"}, ${stats.draft} draft${stats.draft === 1 ? "" : "s"}, and ${stats.paidPlans} paid plan${stats.paidPlans === 1 ? "" : "s"} in motion.`
      : canCreateListing
        ? "Your dashboard is ready. Start with your first listing and build a stronger local presence across the directory."
        : "Your dashboard is ready. Upgrade your account in billing first, then create your first listing.";

  return (
    <DashboardLayout activeTab="overview">
      <OverviewContent
        canCreateListing={canCreateListing}
        greetingName={greetingName}
        recentBusinesses={recentBusinesses}
        schemaNotice={schemaNotice}
        stats={stats}
        subtitle={subtitle}
      />
    </DashboardLayout>
  );

  return (
    <DashboardLayout activeTab="overview">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Welcome back, {user.email}!</h1>
          <p className={styles.pageSubtitle}>
            Manage your listings, billing, and account settings.
          </p>
        </div>
      </div>

      {schemaNotice && (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Database Setup Needed</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Run the Phase 3 Prisma schema sync, then refresh the dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard label="Total Listings" value={stats.total} color="brown" />
        <StatCard label="Active" value={stats.active} color="teal" />
        <StatCard label="Draft" value={stats.draft} color="orange" />
        <StatCard label="Paused" value={stats.paused} color="gray" />
        <StatCard label="Paid Plans" value={stats.paidPlans} color="yellow" />
      </div>

      {/* Recent Listings */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Recent Listings</h2>
          <Link href="/dashboard/businesses" className={styles.link}>
            View All →
          </Link>
        </div>

        {recentBusinesses.length > 0 ? (
          <div className={styles.listContainer}>
            {recentBusinesses.map((business) => (
              <div key={business.id} className={styles.listItem}>
                <div>
                  <h3 className={styles.listItemTitle}>{business.name}</h3>
                  <p className={styles.listItemMeta}>
                    {business.city.name} •{" "}
                    <span className={styles[`status${business.status}`]}>
                      {business.status}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/dashboard/businesses/${business.id}/edit`}
                  className={styles.link}
                >
                  Edit →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyStateTitle}>No listings yet</h3>
            <p className={styles.emptyStateDescription}>
              Create your first listing to get started!
            </p>
            <Link
              href="/dashboard/businesses/new"
              className={styles.emptyStateAction}
            >
              Create Listing
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <QuickActionCard
            title="Create Listing"
            description="Add a new business to the directory"
            href="/dashboard/businesses/new"
          />
          <QuickActionCard
            title="Manage Subscriptions"
            description="View and update your billing"
            href="/dashboard/billing"
          />
          <QuickActionCard
            title="Account Settings"
            description="Update your profile and preferences"
            href="/dashboard/settings"
          />
          <QuickActionCard
            title="Help & Support"
            description="Browse FAQs and contact support"
            href="/help"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    brown: "--retro-brown",
    teal: "--retro-teal",
    orange: "--retro-orange",
    yellow: "--retro-yellow",
    gray: "#999",
  };

  return (
    <div
      className={styles.statCard}
      style={{
        borderLeftColor: `var(${colorMap[color]})`,
      }}
    >
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  );
}

function QuickActionCard({ title, description, href }) {
  return (
    <Link href={href} className={styles.actionCard}>
      <h3 className={styles.actionTitle}>{title}</h3>
      <p className={styles.actionDescription}>{description}</p>
      <span className={styles.actionArrow}>→</span>
    </Link>
  );
}
