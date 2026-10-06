import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaGlobe,
  FaPhone,
} from "react-icons/fa6";
import styles from "./page.module.css";

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function BusinessContactActions({
  phone,
  website,
  businessName,
}) {
  if (!phone && !website) return null;
  return (
    <nav
      className={styles.contactActions}
      aria-label={`Contact ${businessName}`}
    >
      {phone ? (
        <a
          href={`tel:${phone.replace(/[^+\d,;*#]/g, "")}`}
          className={styles.contactAction}
        >
          <span className={styles.contactIcon}>
            <FaPhone aria-hidden="true" />
          </span>
          <span className={styles.contactCopy}>
            <strong>Give us a call</strong>
            <span>{phone}</span>
          </span>
          <FaArrowRight className={styles.contactArrow} aria-hidden="true" />
        </a>
      ) : null}
      {website ? (
        <a
          href={website}
          className={styles.contactAction}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.contactIcon}>
            <FaGlobe aria-hidden="true" />
          </span>
          <span className={styles.contactCopy}>
            <strong>Visit website</strong>
            <span>{getDomain(website)}</span>
          </span>
          <FaArrowUpRightFromSquare
            className={styles.contactArrow}
            aria-hidden="true"
          />
          <span className={styles.srOnly}> (opens in a new tab)</span>
        </a>
      ) : null}
    </nav>
  );
}
