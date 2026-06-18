import Link from "next/link";

import { getBlobImageUrl } from "@/lib/blob";

import styles from "./BusinessCard.module.css";

const BADGE_TONES = {
  yellow: styles.badgeYellow,
  red: styles.badgeRed,
  teal: styles.badgeTeal,
  orange: styles.badgeOrange,
};

/**
 * Marketing-style business card used on the home page and future city pages.
 * For future Phase 2 detail pages, prefer the richer `/results`-variant card.
 *
 * Props:
 *   - business:
 *       { slug, name, city, description, price, category, imageUrl, imageAlt }
 *   - badgeTone:  "yellow" | "red" | "teal" | "orange" (default "yellow")
 *   - href:       link target (default `/business/${business.slug}`)
 */
export default function BusinessCard({ business, badgeTone = "yellow", href }) {
  const {
    slug,
    name,
    city,
    description,
    price,
    category,
    imageUrl,
    imageAlt,
  } = business;

  const linkHref = href ?? (slug ? `/business/${slug}` : "#");
  const toneClass = BADGE_TONES[badgeTone] ?? BADGE_TONES.yellow;

  return (
    <article className={styles.businessCard}>
      <div className={styles.businessImageContainer}>
        <img alt={imageAlt ?? name} className={styles.businessImage} src={getBlobImageUrl(imageUrl)} />
      </div>

      {city && <div className={`${styles.businessBadge} ${toneClass}`}>{city}</div>}

      <h3 className={styles.businessTitle}>{name}</h3>

      {description && <p className={styles.businessDescription}>{description}</p>}

      <div className={styles.businessFooter}>
        <span className={styles.businessCategory}>
          {price ? `${price} • ` : ""}
          {category?.toUpperCase() ?? ""}
        </span>
        <Link
          href={linkHref}
          className={styles.businessArrowButton}
          aria-label={`View ${name}`}
        >
          <span className={`material-icons ${styles.arrowIcon}`} aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </div>
    </article>
  );
}

// this do be a comment
