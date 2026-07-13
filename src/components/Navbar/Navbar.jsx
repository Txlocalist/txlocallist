import Image from "next/image";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import NavbarMobileMenu from "./NavbarMobileMenu";
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
 */
export default async function Navbar({ links = DEFAULT_LINKS }) {
  const user = await getCurrentUser().catch(() => null);

  const pillHref = user ? "/dashboard" : "/login";
  const pillLabel = user ? "DASHBOARD" : "LOGIN";
  const pillClass = user ? styles.navDashboardButton : styles.navLoginButton;

  return (
    <nav className={styles.nav} aria-label="Primary" data-primary-nav>
      <div className={styles.navBrand}>
        <Link href="/" aria-label="Texas Localist Home" className={styles.logo}>
          <Image
            src="/Main-Logo.svg"
            alt="Texas Localist"
            width={220}
            height={96}
            className={styles.logoImage}
            priority
          />
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

      <NavbarMobileMenu links={links} pillHref={pillHref} pillLabel={pillLabel} />
    </nav>
  );
}
