"use client";

import Link from "next/link";
import { FaTicket } from "react-icons/fa6";
import { getActiveOffers } from "@/lib/business-offers";
import useOfferDate from "./useOfferDate";
import styles from "./BusinessOffers.module.css";

export default function OfferBadge({ slug, offers = [], compact = false, variant = "badge", today: initialToday }) {
  const today = useOfferDate(initialToday);
  if (!getActiveOffers(offers, today).length) return null;
  return (
    <Link href={`/business/${slug}#special-offers`} className={`${styles.badge} ${variant === "tag" ? styles.tag : compact ? styles.compact : ""}`}>
      <FaTicket aria-hidden="true" /> Special Offer
    </Link>
  );
}
