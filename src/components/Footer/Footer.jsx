import Image from "next/image";
import Link from "next/link";

import logo from "@/app/assets/Tx-Localist-01.png";
import styles from "./Footer.module.css";

/**
 * Marketing footer for public pages.
 *
 * Props:
 *   - links:   array of { href, label }
 *   - socials: array of { href, icon, label } (icon is a material-icons name)
 */
export default function Footer({
  links = [
    { href: "/about", label: "ABOUT" },
    { href: "/how-it-works", label: "HOW IT WORKS" },
    { href: "/terms", label: "TERMS" },
    { href: "/privacy", label: "PRIVACY" },
    { href: "/contact", label: "CONTACT" },
  ],
  socials = [
    { href: "#", icon: "share", label: "Share Texas Localist" },
    { href: "#", icon: "camera_alt", label: "Instagram" },
  ],
  compact = false,
}) {
  return (
    <footer className={`${styles.footer} ${compact ? styles.footerCompact : ""}`}>
      <div className={styles.footerContainer}>
        <Link href="/" className={styles.footerLogo} aria-label="Texas Localist - Home">
          <Image
            alt="Texas Localist"
            src={logo}
            width={80}
            height={80}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </Link>

        <nav className={styles.footerLinks} aria-label="Footer">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={styles.footerLink}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.footerSocial}>
          {socials.map((social, idx) => (
            <a
              key={`${social.icon}-${idx}`}
              href={social.href}
              className={styles.socialButton}
              aria-label={social.label}
            >
              <span className={`material-icons ${styles.socialIcon}`} aria-hidden="true">
                {social.icon}
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className={styles.footerCopyright}>
        © {new Date().getFullYear()} TEXAS LOCALIST. ALL RIGHTS RESERVED. HANDCRAFTED IN THE LONE STAR STATE.
      </div>
    </footer>
  );
}
