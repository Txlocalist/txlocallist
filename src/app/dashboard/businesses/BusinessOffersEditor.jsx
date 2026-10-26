"use client";

import { useId } from "react";
import { FaTicket, FaPlus } from "react-icons/fa6";
import { MAX_BUSINESS_OFFERS, OFFER_LIMITS, getOfferStatus } from "@/lib/business-offers";
import { OfferTicket } from "@/components/BusinessOffers/BusinessOffers";
import useOfferDate from "@/components/BusinessOffers/useOfferDate";
import styles from "./BusinessOffersEditor.module.css";

export default function BusinessOffersEditor({ offers, onChange, disabled = false }) {
  const id = useId();
  const today = useOfferDate();
  const update = (index, field, value) => onChange(offers.map((offer, i) => i === index ? { ...offer, [field]: value } : offer));
  return (
    <section className={styles.editor} aria-labelledby={`${id}-heading`}>
      <div className={styles.heading}>
        <h3 id={`${id}-heading`}><FaTicket aria-hidden="true" /> Coupons & Special Offers</h3>
        <span>{offers.length} of {MAX_BUSINESS_OFFERS}</span>
      </div>
      <p className={styles.hint}>Give your neighbors a little extra. Add up to three offers they can show when visiting or use with a coupon code.</p>
      {!offers.length && <p className={styles.empty}>A great deal is a great reason to stop by.</p>}
      {offers.map((offer, index) => (
        <fieldset key={offer.id || offer.editorKey || index} className={styles.offer} disabled={disabled}>
          <legend>Offer {index + 1} <span>{getOfferStatus(offer, today)}</span></legend>
          <div className={styles.actions}>
            <label className={styles.toggle}><input type="checkbox" checked={offer.enabled ?? true} onChange={(event) => update(index, "enabled", event.target.checked)} /> Offer enabled</label>
            <button type="button" onClick={() => onChange(offers.filter((_, i) => i !== index))} aria-label={`Remove offer ${index + 1}`}>Remove offer</button>
          </div>
          <p className={styles.hint}>Uncheck to pause. Your details will stay saved.</p>
          <div className={styles.layout}>
            <div className={styles.fields}>
              {[
                ["headline", "Offer headline", "e.g., 20% off your first visit", false, true],
                ["description", "Offer details", "What can your neighbors look forward to?", true, true],
                ["instructions", "How to redeem", "e.g., Show this offer at checkout.", true, true],
                ["code", "Coupon code (optional)", "e.g., LOCAL20", false, false],
                ["terms", "Terms (optional)", "e.g., One per customer. Cannot be combined with other offers.", true, false],
              ].map(([field, label, placeholder, multiline, required]) => {
                const Control = multiline ? "textarea" : "input";
                return <label key={field} className={styles.field}>
                  <span>{label}{required ? " *" : ""}</span>
                  <Control value={offer[field] || ""} onChange={(event) => update(index, field, event.target.value)} placeholder={placeholder} maxLength={OFFER_LIMITS[field]} required={required} {...(multiline ? { rows: 3 } : { type: "text" })} />
                </label>;
              })}
              <div className={styles.dates}>
                <label className={styles.field}><span>Start date (optional)</span><input type="date" value={offer.startDate || ""} onChange={(event) => update(index, "startDate", event.target.value)} /></label>
                <label className={styles.field}><span>End date (optional)</span><input type="date" min={offer.startDate || undefined} value={offer.endDate || ""} onChange={(event) => update(index, "endDate", event.target.value)} /></label>
              </div>
              <p className={styles.hint}>Dates use Central Time. Offers stay valid through the end date. Leave dates blank for an ongoing offer.</p>
            </div>
            <div className={styles.preview}><p className={styles.previewLabel}>Your coupon preview</p><OfferTicket offer={offer} preview today={today} /></div>
          </div>
        </fieldset>
      ))}
      <button type="button" className={styles.add} disabled={disabled || offers.length >= MAX_BUSINESS_OFFERS} onClick={() => onChange([...offers, { editorKey: crypto.randomUUID(), headline: "", description: "", instructions: "", code: "", terms: "", startDate: "", endDate: "", enabled: true }])}>
        <FaPlus aria-hidden="true" /> Add offer
      </button>
      {offers.length >= MAX_BUSINESS_OFFERS && <p className={styles.hint}>All three spots are filled. Update or remove an offer to make room for a new one.</p>}
    </section>
  );
}
