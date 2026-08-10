import Link from "next/link";

import styles from "./EventLandingHeader.module.css";

const LINKS = [
  { href: "/events", label: "Explore" },
  { href: "/pricing", label: "Pricing" },
  { href: "/post-an-event", label: "Post Event" },
  { href: "/about", label: "About" },
  { href: "/post-your-business", label: "Add Listing" },
];

export default function EventLandingHeader() {
  return (
    <header className={styles.header} data-event-landing-header>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} aria-label="Texas Localist home">
          <span className={styles.logoState}>Texas</span>
          <span className={styles.logoWord}>Localist</span>
          <span className={styles.logoUrl}>TXLocalist.com</span>
        </Link>

        <nav className={styles.links} aria-label="Event navigation">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <details className={styles.mobileMenu}>
          <summary>Menu</summary>
          <nav aria-label="Event mobile navigation">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </details>

        <Link href="/login" className={styles.loginButton}>
          Login
        </Link>
      </div>
    </header>
  );
}
