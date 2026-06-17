import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "./AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import styles from "@/app/dashboard/dashboard.module.css";

function formatDate(val) {
  if (!val) return "Never";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(val));
}

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();

  let stats = { users: 0, owners: 0, businesses: 0, activeBusinesses: 0, events: 0 };
  let recentUsers = [];
  let recentBusinesses = [];
  let schemaNotice = null;

  try {
    const [userCount, ownerCount, bizCount, activeBizCount, recentUsersData, recentBizData] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where: { role: "OWNER" } }),
        prisma.business.count(),
        prisma.business.count({ where: { status: "ACTIVE" } }),
        prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, email: true, role: true, createdAt: true, lastLoginAt: true },
        }),
        prisma.business.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { city: true, owner: { select: { email: true } } },
        }),
      ]);

    stats = { users: userCount, owners: ownerCount, businesses: bizCount, activeBusinesses: activeBizCount };
    recentUsers = recentUsersData;
    recentBusinesses = recentBizData;

    // Events may not exist yet
    try {
      stats.events = await prisma.event.count();
    } catch (_) {}
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "Database schema not fully applied. Run npm run db:push.";
    } else {
      throw error;
    }
  }

  return (
    <AdminShell activeTab="overview">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Platform Overview</h1>
          <p className={styles.pageSubtitle}>Real-time stats for TX Localist</p>
        </div>
      </div>

      {schemaNotice && (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Schema Not Ready</h2>
            <p className={styles.emptyStateDescription}>{schemaNotice}</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Users",      value: stats.users,            icon: "group",      color: "var(--retro-teal)" },
          { label: "Business Owners",  value: stats.owners,           icon: "storefront", color: "var(--retro-orange)" },
          { label: "All Listings",     value: stats.businesses,       icon: "list_alt",   color: "var(--retro-brown)" },
          { label: "Live Listings",    value: stats.activeBusinesses, icon: "check_circle", color: "var(--retro-teal)" },
          { label: "Events",           value: stats.events,           icon: "event",      color: "var(--retro-red)" },
        ].map((s) => (
          <div key={s.label} className={styles.card} style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span className="material-icons" style={{ fontSize: "1.75rem", color: s.color }}>{s.icon}</span>
            <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--retro-brown)", margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {[
          { href: "/admin/posts",      label: "Review Posts",      icon: "inventory_2" },
          { href: "/admin/users",      label: "Manage Users",      icon: "group" },
          { href: "/admin/tags",       label: "Manage Tags",       icon: "label" },
          { href: "/admin/settings",   label: "Create Admin",      icon: "admin_panel_settings" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className={styles.createButton} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="material-icons" style={{ fontSize: "1rem" }}>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Recent users */}
      {recentUsers.length > 0 && (
        <>
          <div className={styles.pageHeader} style={{ marginTop: "1rem" }}>
            <h2 className={styles.pageTitle} style={{ fontSize: "1.25rem" }}>Recent Users</h2>
            <Link href="/admin/users" className={styles.actionButton}>View All</Link>
          </div>
          <div className={styles.businessesTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableCol} style={{ flex: 2 }}>Email</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>Role</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>Joined</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>Last Login</div>
            </div>
            <div className={styles.tableBody}>
              {recentUsers.map((u) => (
                <div key={u.id} className={styles.tableRow}>
                  <div className={styles.tableCol} style={{ flex: 2 }}><p className={styles.businessName}>{u.email}</p></div>
                  <div className={styles.tableCol} style={{ flex: 1 }}>
                    <span className={u.role === "ADMIN" ? styles.statusACTIVE : styles.statusDRAFT}>{u.role}</span>
                  </div>
                  <div className={styles.tableCol} style={{ flex: 1 }}>{formatDate(u.createdAt)}</div>
                  <div className={styles.tableCol} style={{ flex: 1 }}>{formatDate(u.lastLoginAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recent businesses */}
      {recentBusinesses.length > 0 && (
        <>
          <div className={styles.pageHeader} style={{ marginTop: "2rem" }}>
            <h2 className={styles.pageTitle} style={{ fontSize: "1.25rem" }}>Recent Listings</h2>
            <Link href="/admin/posts?type=businesses" className={styles.actionButton}>View All</Link>
          </div>
          <div className={styles.businessesTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableCol} style={{ flex: 2 }}>Business</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>Owner</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>City</div>
              <div className={styles.tableCol} style={{ flex: 1 }}>Status</div>
            </div>
            <div className={styles.tableBody}>
              {recentBusinesses.map((b) => (
                <div key={b.id} className={styles.tableRow}>
                  <div className={styles.tableCol} style={{ flex: 2 }}><p className={styles.businessName}>{b.name}</p></div>
                  <div className={styles.tableCol} style={{ flex: 1 }}><p className={styles.businessMeta}>{b.owner.email}</p></div>
                  <div className={styles.tableCol} style={{ flex: 1 }}>{b.city?.name ?? "—"}</div>
                  <div className={styles.tableCol} style={{ flex: 1 }}>
                    <span className={styles["status" + b.status]}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
