"use client";

import { useState } from "react";

import styles from "./page.module.css";

export default function EventHeroImage({ src, alt, type, dateLabel, timeLabel, cityLabel }) {
  const [useFallback, setUseFallback] = useState(!src);

  if (useFallback) {
    return (
      <div className={styles.fallbackTicket} role="img" aria-label={`${type} event admission ticket`}>
        <div className={styles.ticketGlow} />
        <div className={styles.ticketStub}>
          <span>Texas Localist</span>
          <strong>Admit One</strong>
          <small>{type}</small>
        </div>
        <div className={styles.ticketMain}>
          <span className={styles.ticketKicker}>Local Event</span>
          <strong>{type}</strong>
          <span className={styles.ticketStar}>★</span>
          <p>{dateLabel}</p>
          <p>{timeLabel}</p>
          <small>{cityLabel}</small>
        </div>
      </div>
    );
  }

  return (
    // User uploads may be proxied private blobs, so runtime failure handling is
    // more important here than Next Image's compile-time source allow-list.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setUseFallback(true)} />
  );
}
