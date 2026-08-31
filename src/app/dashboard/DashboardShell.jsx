import Image from "next/image";
import Link from "next/link";

import logo from "@/app/assets/Tx-Localist-01.png";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccountAccess } from "@/lib/account-access";
import {
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";

import styles from "./DashboardShell.module.css";

/**
 * Dashboard wrapper layout with a Figma-inspired sidebar shell.
 */
export async function DashboardLayout({ children, activeTab = "overview" }) {
  const session = await getCurrentSession().catch(() => null);
  const user = session?.user ?? null;
  const billingState = user?.id ? await getAccountAccess(user.id).catch(() => null) : null;
  const hasCreatorAccess = Boolean(billingState?.hasCreatorAccess);
  const eventPostPrice = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);
  const oneTimePostingEnabled = isEventPostingEnabled();
  const creatorAccessLabel = billingState?.hasComplimentaryAccess
    ? "Complimentary Access"
    : billingState?.hasStaffAccess
      ? "Staff Access"
      : "Creator Access";
  const creatorAccessText = billingState?.hasComplimentaryAccess
    ? "TX Localist has provided your creator tools at no charge."
    : billingState?.hasStaffAccess
      ? "Your staff role includes creator tools without a paid subscription."
      : oneTimePostingEnabled
        ? "Your membership includes business-linked events. Standalone event posts are also available."
        : "Your membership includes business-linked events. One-time Checkout is currently paused.";
  const navSections = [
    {
      title: "Posts",
      icon: "campaign",
      items: [
        { id: "events-live", label: "My Events", href: "/dashboard/events", icon: "event" },
        {
          id: "events-create",
          label: "Post Event",
          href: "/dashboard/events/new",
          icon: "add_circle",
        },
        {
          id: "events-saved",
          label: "Saved Events",
          href: "/dashboard/events/saved",
          icon: "bookmark",
        },
      ],
    },
    {
      title: "Businesses",
      icon: "storefront",
      items: [
        {
          id: "businesses-live",
          label: "Live Businesses",
          href: "/dashboard/businesses",
          icon: "storefront",
        },
        {
          id: "businesses-create",
          label: "Create Business",
          href: "/dashboard/businesses/new",
          icon: "add_business",
        },
        {
          id: "businesses-saved",
          label: "Saved Businesses",
          href: "/dashboard/businesses/saved",
          icon: "bookmark",
        },
      ],
    },
    {
      title: "Account",
      icon: "manage_accounts",
      items: [
        { id: "billing", label: "Billing", href: "/dashboard/billing", icon: "payments" },
        { id: "settings", label: "Settings", href: "/dashboard/settings", icon: "settings" },
      ],
    },
  ];

  const openSections = new Set();
  if (activeTab?.startsWith("events-")) {
    openSections.add("Posts");
  }
  if (activeTab?.startsWith("businesses-")) {
    openSections.add("Businesses");
  }
  if (activeTab === "billing" || activeTab === "settings") {
    openSections.add("Account");
  }

  const sectionTitles = {
    overview: "Dashboard",
    "events-live": "My Events",
    "events-create": "Post Event",
    "events-saved": "Saved Events",
    "businesses-live": "Live Businesses",
    "businesses-create": hasCreatorAccess ? "Create Business" : "Upgrade Account",
    "businesses-saved": "Saved Businesses",
    billing: "Billing",
    settings: "Settings",
  };

  const userInitial = user?.email?.trim()?.charAt(0)?.toUpperCase() || "T";
  const userLabel = user?.email || "User account";

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
                <p className={styles.brandTitle}>The Local Hub</p>
                <p className={styles.brandSubtitle}>Business portal</p>
              </div>
            </Link>
          </div>

          <nav className={styles.sidebarNav}>
            {navSections.map((section) => (
              <details
                key={section.title}
                className={styles.navSection}
                open={openSections.has(section.title)}
              >
                <summary className={styles.navSectionSummary}>
                  <span className={styles.navSectionLead}>
                    <span className={styles.navSectionIconWrap}>
                      <span className={`material-icons ${styles.navSectionIcon}`} aria-hidden="true">
                        {section.icon}
                      </span>
                    </span>
                    <span className={styles.navSectionTitle}>{section.title}</span>
                  </span>
                  <span className={`material-icons ${styles.navSectionChevron}`} aria-hidden="true">
                    expand_more
                  </span>
                </summary>
                <div className={styles.navSectionItems}>
                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`${styles.navLink} ${activeTab === item.id ? styles.navLinkActive : ""}`}
                    >
                      <span className={`material-icons ${styles.navLinkIcon}`} aria-hidden="true">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.helpCard}>
              <p className={styles.helpEyebrow}>{hasCreatorAccess ? creatorAccessLabel : "Billing Access"}</p>
              <p className={styles.helpText}>
                {hasCreatorAccess
                  ? creatorAccessText
                  : oneTimePostingEnabled
                    ? `Browse and save for free, or post one event for a ${eventPostPrice} one-time fee.`
                    : "Browse local businesses and save favorites for free."}
              </p>
            </div>
          </div>
        </aside>

        <section className={styles.mainPane}>
          <header className={styles.topbar}>
            <div>
              <p className={styles.topbarTitle}>{sectionTitles[activeTab] || "Dashboard"}</p>
            </div>

            <div className={styles.topbarActions}>
              <button type="button" className={styles.notificationButton} aria-label="Notifications">
                <span className="material-icons" aria-hidden="true">
                  notifications_none
                </span>
              </button>

              <div className={styles.profilePill}>
                <div className={styles.profileAvatar}>{userInitial}</div>
                <div className={styles.profileText}>
                  <span className={styles.profileEmail}>{userLabel}</span>
                  <span className={styles.profileRole}>{user?.role || "USER"}</span>
                </div>
              </div>

              <form action={logoutAction} className={styles.logoutForm}>
                <button type="submit" className={styles.logoutButton}>
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
