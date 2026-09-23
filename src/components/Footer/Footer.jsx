import Image from "next/image";
import Link from "next/link";
import { FaFacebookF, FaInstagram, FaTiktok } from "react-icons/fa6";

import styles from "./Footer.module.css";

/**
 * Marketing footer for public pages.
 *
 * Props:
 *   - links:   array of { href, label }
 *   - socials: array of { href, icon, label } (icon is a React component)
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
    { href: "https://www.facebook.com/profile.php?id=61589432485668", icon: FaFacebookF, label: "Facebook" },
    { href: "https://www.instagram.com/Texas_Localist", icon: FaInstagram, label: "Instagram" },
    { href: "https://www.tiktok.com/@thetexaslocalist", icon: FaTiktok, label: "TikTok" },
  ],
  compact = false,
}) {
  return (
    <footer className={`${styles.footer} ${compact ? styles.footerCompact : ""}`}>
      <div className={styles.footerContainer}>
        <Link href="/" className={styles.footerLogo} aria-label="Texas Localist - Home">
          <Image
            alt="Texas Localist"
            src="/Main-Logo.svg"
            width={220}
            height={105}
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
          {socials.map((social) => {
            const SocialIcon = social.icon;
            return (
              <a
                key={social.label}
                href={social.href}
                className={styles.socialButton}
                aria-label={social.label}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SocialIcon className={styles.socialIcon} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </div>

      <div className={styles.footerCopyright}>
        © {new Date().getFullYear()} TEXAS LOCALIST. ALL RIGHTS RESERVED. HANDCRAFTED IN THE LONE STAR STATE.
      </div>
    </footer>
  );
}
