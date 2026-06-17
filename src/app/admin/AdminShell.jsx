import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import logo from "@/app/assets/Tx-Localist-01.png";
import styles from "@/app/dashboard/DashboardShell.module.css";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Admin layout shell using the shared dashboard styling
 * with admin-specific navigation and access gating.
 */
export async function AdminShell({ children, activeTab = "overview" }) {
  const session = await getCurrentSession().catch(() => null);
  const user = session?.user ?? null;

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const tabs = [
    { id: "overview", label: "Overview", href: "/admin", icon: "dashboard" },
    { id: "posts", label: "Posts", href: "/admin/posts", icon: "inventory_2" },
    { id: "users", label: "Users", href: "/admin/users", icon: "group" },
    { id: "tags", label: "Tags", href: "/admin/tags", icon: "label" },
    { id: "settings", label: "Admin Tools", href: "/admin/settings", icon: "admin_panel_settings" },
  ];

  const sectionTitles = {
    overview: "Admin Overview",
    posts: "Review Posts",
    users: "Manage Users",
    tags: "Manage Tags",
    settings: "Admin Tools",
  };

  const userInitial = user?.email?.trim()?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboardContainer}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link href="/" className={styles.brandLink}>
              <div className={styles.brandMark}>
                <Image
                  src={logo}
                  alt="TX Local List"
                  width={56}
                  height={56}
                  className={styles.brandImage}
                  priority
                />
              </div>
              <div className={styles.brandText}>
                <p className={styles.brandTitle}>Admin Panel</p>
                <p className={styles.brandSubtitle}>TX Localist</p>
              </div>
            </Link>
          </div>

          <Link href="/dashboard" className={styles.sidebarCta}>
            {"<-"} User Dashboard
          </Link>

          <nav className={styles.sidebarNav}>
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`${styles.navLink} ${activeTab === tab.id ? styles.navLinkActive : ""}`}
              >
                <span className={`material-icons ${styles.navLinkIcon}`} aria-hidden="true">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </Link>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <div
              className={styles.helpCard}
              style={{ borderLeft: "3px solid var(--retro-red)" }}
            >
              <p
                className={styles.helpEyebrow}
                style={{ color: "var(--retro-red)" }}
              >
                Admin Access
              </p>
              <p className={styles.helpText}>
                Actions here affect all users and listings platform-wide.
              </p>
            </div>
          </div>
        </aside>

        <section className={styles.mainPane}>
          <header className={styles.topbar}>
            <div>
              <p className={styles.topbarTitle}>{sectionTitles[activeTab] || "Admin"}</p>
            </div>

            <div className={styles.topbarActions}>
              <div
                className={styles.profilePill}
                style={{
                  background: "rgba(214,73,51,0.08)",
                  border: "1.5px solid var(--retro-red)",
                }}
              >
                <div
                  className={styles.profileAvatar}
                  style={{ background: "var(--retro-red)", color: "white" }}
                >
                  {userInitial}
                </div>
                <div className={styles.profileText}>
                  <span className={styles.profileEmail}>{user.email}</span>
                  <span
                    className={styles.profileRole}
                    style={{ color: "var(--retro-red)" }}
                  >
                    ADMIN
                  </span>
                </div>
              </div>

              <form action={logoutAction} className={styles.logoutForm}>
                <button
                  type="submit"
                  className={styles.logoutButton}
                  style={{
                    borderColor: "rgba(214, 73, 51, 0.22)",
                    color: "var(--retro-red)",
                  }}
                >
                  <span className="material-icons" aria-hidden="true">
                    logout
                  </span>
                  <span>Log out</span>
                </button>
              </form>
            </div>
          </header>

          <main className={styles.mainContent}>{children}</main>
        </section>
      </div>
    </div>
  );
}
