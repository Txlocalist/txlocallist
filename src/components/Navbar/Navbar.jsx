import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import styles from "./Navbar.module.css";

const DEFAULT_LINKS = [
  { href: "/results", label: "EXPLORE" },
  { href: "/how-it-works", label: "HOW IT WORKS" },
  { href: "/about", label: "ABOUT" },
  { href: "/pricing", label: "PRICING" },
  { href: "/post-your-business", label: "ADD LISTING" },
];

/**
 * Top navigation - server component, auth-aware.
 *
 * Props:
 *   - links: array of { href, label } overrides
 *   - onMenuOpen: optional handler for the mobile menu button
 */
export default async function Navbar({ links = DEFAULT_LINKS, onMenuOpen }) {
  const user = await getCurrentUser().catch(() => null);

  const pillHref = user ? "/dashboard" : "/login";
  const pillLabel = user ? "DASHBOARD" : "LOGIN";
  const pillClass = user ? styles.navDashboardButton : styles.navLoginButton;

  return (
    <nav className={styles.nav} aria-label="Primary" data-primary-nav>
      <div className={styles.navBrand}>
        <Link href="/" aria-label="Texas Localist Home" className={styles.logo}>
          <span className={styles.logoState}>Texas</span>
          <span className={styles.logoWord}>Localist</span>
          <span className={styles.logoUrl}>TXLocalist.com</span>
        </Link>
      </div>

      <div className={styles.navLinks}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.navLink}>
            {link.label}
          </Link>
        ))}
        <Link href={pillHref} className={pillClass} aria-label={pillLabel}>
          {pillLabel}
        </Link>
      </div>

      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open navigation menu"
        onClick={onMenuOpen}
      >
        <span className="material-icons" aria-hidden="true">
          menu
        </span>
      </button>
    </nav>
  );
}
