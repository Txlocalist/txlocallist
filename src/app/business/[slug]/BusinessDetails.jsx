import {
  FaArrowRight,
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { FaLink } from "react-icons/fa";
import Link from "next/link";
import styles from "./page.module.css";

const SOCIAL_ICONS = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  twitter: FaXTwitter,
  x: FaXTwitter,
  tiktok: FaTiktok,
  youtube: FaYoutube,
  linkedin: FaLinkedinIn,
};

function getSocialLabel(platform) {
  if (platform?.toLowerCase() === "x") return "X (formerly Twitter)";
  const value = platform?.trim() || "social profile";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function BusinessDetails({
  business,
  showContact,
  showSocials,
  hoursRows,
  hiringRoles,
  hiringApplyHref,
  mapsUrl,
}) {
  return (
    <section className={styles.bentoSection} aria-label="Business details">
      <div className={styles.bentoGrid}>
        <div className={styles.detailColumn}>
          {/* About card */}
          <div className={styles.aboutCard}>
            <h2 className={styles.aboutTitle}>About {business.name}</h2>
            <p className={styles.aboutDesc}>{business.description}</p>

            {(business.categories.length > 0 || business.tags.length > 0) && (
              <div className={styles.chipRow}>
                {business.categories.map((bc) => (
                  <Link
                    key={bc.category.id}
                    href={`/categories/${bc.category.slug}`}
                    className={styles.chip}
                  >
                    {bc.category.name}
                  </Link>
                ))}
                {business.tags.map((bt) => (
                  <Link
                    key={bt.tag.id}
                    href={`/results?q=${encodeURIComponent(bt.tag.name)}`}
                    className={styles.chipTag}
                  >
                    #{bt.tag.name}
                  </Link>
                ))}
              </div>
            )}

            {!showContact && (
              <div className={styles.upgradeNudge}>
                <span
                  className="material-icons"
                  style={{
                    fontSize: "1.5rem",
                    color: "var(--retro-yellow)",
                    flexShrink: 0,
                  }}
                >
                  lock
                </span>
                <div>
                  <p className={styles.upgradeNudgeTitle}>
                    Contact info hidden
                  </p>
                  <p className={styles.upgradeNudgeDesc}>
                    This business hasn&apos;t upgraded yet. Know the owner?
                  </p>
                </div>
                <Link href="/about#pricing" className={styles.upgradeNudgeBtn}>
                  View Plans →
                </Link>
              </div>
            )}
          </div>

          {business.isHiring && (
            <section
              id="join-the-crew"
              className={styles.hiringSectionAnchor}
              aria-labelledby="hiring-title"
            >
              <div className={styles.hiringCard}>
                <div>
                  <p className={styles.eyebrow}>Now Hiring</p>
                  <h2 id="hiring-title" className={styles.hiringTitle}>
                    Your next job, right here.
                  </h2>
                  <p className={styles.hiringDescription}>
                    {business.name} is looking for local talent. Introduce
                    yourself and take the next step.
                  </p>
                  {hiringRoles.length > 0 && (
                    <div className={styles.hiringRolesRow}>
                      {hiringRoles.map((role) => (
                        <span key={role} className={styles.hiringRoleChip}>
                          {role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Link href={hiringApplyHref} className={styles.hiringApplyBtn}>
                  Join the crew <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}
        </div>
        <div className={styles.detailColumn}>
          {/* Hours + Social card (dark) */}
          <div className={styles.hoursCard}>
            <h3 className={styles.hoursTitle}>Service Hours</h3>
            <div className={styles.hoursList}>
              {hoursRows.map((day) => (
                <div key={day.dayOfWeek} className={styles.hoursRow}>
                  <span className={styles.hoursDay}>{day.label}</span>
                  <span className={styles.hoursVal}>{day.value}</span>
                </div>
              ))}
            </div>

            {showSocials && business.socialLinks.length > 0 && (
              <div className={styles.socialRow}>
                {business.socialLinks.map((link) =>
                  (() => {
                    const Icon =
                      SOCIAL_ICONS[link.platform?.toLowerCase()] ?? FaLink;
                    const label = getSocialLabel(link.platform);
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialIcon}
                        aria-label={`Visit ${business.name} on ${label}`}
                        title={label}
                      >
                        <Icon aria-hidden="true" focusable="false" />
                      </a>
                    );
                  })(),
                )}
              </div>
            )}
          </div>
          {business.address ? (
            <section>
              <div className={styles.locationCard}>
                <div className={styles.locationInfo}>
                  <p className={styles.eyebrow}>Visit Us</p>
                  <h2 className={styles.locationTitle}>Find the Spot</h2>

                  <div className={styles.addressBlock}>
                    <span
                      className="material-icons"
                      style={{
                        fontSize: "1.6rem",
                        color: "var(--retro-red)",
                        flexShrink: 0,
                        marginTop: "0.1rem",
                      }}
                    >
                      location_on
                    </span>
                    <div>
                      <p className={styles.addressText}>
                        {business.address},<br />
                        {business.city.name}, TX
                      </p>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.directionsLink}
                      >
                        Get Directions
                      </a>
                    </div>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapsBtn}
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
