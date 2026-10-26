"use client";

import { useState } from "react";
import { FaTicket, FaRegCopy, FaCheck } from "react-icons/fa6";
import { formatOfferDate, getActiveOffers, getOfferStatus } from "@/lib/business-offers";
import useOfferDate from "./useOfferDate";
import styles from "./BusinessOffers.module.css";

export function OfferTicket({ offer, preview = false, today }) {
  const [copyState, setCopyState] = useState("");
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <article className={styles.ticket} aria-label={offer.headline || "Offer preview"}>
      <div className={styles.ticketTop}>
        <span><FaTicket aria-hidden="true" /> A local little extra</span>
        {preview && <span className={styles.status}>{getOfferStatus(offer, today)}</span>}
      </div>
      <div className={styles.ticketBody}>
        <h3>{offer.headline || "Your next great deal"}</h3>
        <p className={styles.description}>{offer.description || "Tell your neighbors what makes this offer special."}</p>
        <p className={styles.validity}>{offer.endDate ? `Valid through ${formatOfferDate(offer.endDate)}` : "Ongoing offer"}</p>
        {preview && offer.startDate && <p className={styles.validity}>Starts {formatOfferDate(offer.startDate)}</p>}
      </div>
      <div className={styles.redeem}>
        <p className={styles.redeemLabel}>Make it yours</p>
        <p>{offer.instructions || "Show this offer when you visit."}</p>
        {offer.code && (
          <div className={styles.codeRow}>
            <code aria-label="Coupon code">{offer.code}</code>
            {!preview && <button type="button" onClick={copyCode} aria-label={`Copy code for ${offer.headline}`}>
              {copyState === "copied" ? <FaCheck aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
              {copyState === "copied" ? "Copied!" : "Copy code"}
            </button>}
          </div>
        )}
        {!preview && <p className={styles.copyStatus} role="status">{copyState === "copied" ? "Coupon code copied." : copyState === "failed" ? "Select and copy the code above to use this offer." : ""}</p>}
        {offer.terms && <p className={styles.terms}>{offer.terms}</p>}
      </div>
    </article>
  );
}

export default function BusinessOffers({ offers = [], today: initialToday }) {
  const today = useOfferDate(initialToday);
  const active = getActiveOffers(offers, today);
  if (!active.length) return null;
  return (
    <section id="special-offers" className={styles.section} aria-labelledby="special-offers-title">
      <h2 id="special-offers-title">Coupons & Special Offers</h2>
      <p className={styles.intro}>A little more to love about shopping local.</p>
      <div className={styles.grid}>
        {active.map((offer, index) => <OfferTicket key={offer.id || index} offer={offer} />)}
      </div>
    </section>
  );
}
