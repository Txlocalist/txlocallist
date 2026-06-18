"use client";

import { useState } from "react";
import { useActionState } from "react";

import { createEventAction } from "@/app/actions/events";
import { PhotoUploader } from "@/components/PhotoUploader";

import styles from "./form.module.css";

const INITIAL_STATE = { error: null, fieldErrors: {} };

export function CreateEventForm({ businesses = [] }) {
  const [state, formAction, isPending] = useActionState(createEventAction, INITIAL_STATE);
  const [photos, setPhotos] = useState([]);

  return (
    <form action={formAction} className={styles.form}>
      {state?.error && (
        <div className={styles.errorMessage}>{state.error}</div>
      )}

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Event Details</h2>
        <p className={styles.stepDescription}>Tell people what is happening, where, and when.</p>

        {/* Title */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="title">Event Title *</label>
          <input
            id="title" name="title" type="text"
            className={styles.input}
            placeholder="e.g. Austin Farmers Market"
            required
          />
          {state?.fieldErrors?.title && <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.title}</p>}
        </div>

        {/* Description */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="description">Description *</label>
          <textarea
            id="description" name="description" rows={4}
            className={styles.textarea}
            placeholder="Tell people what this event is about (at least 20 characters)..."
            required
          />
          {state?.fieldErrors?.description && <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.description}</p>}
        </div>

        {/* Cover Image */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Cover Image</label>
          <input type="hidden" name="imageUrl" value={photos[0]?.url || ""} />
          <PhotoUploader photos={photos} onChange={setPhotos} maxPhotos={1} />
          <p className={styles.uploadHint}>
            Event images upload to the same private Vercel Blob storage used for business photos.
          </p>
        </div>

        {/* Dates */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="startDate">Start Date &amp; Time</label>
            <input id="startDate" name="startDate" type="datetime-local" className={styles.input} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="endDate">End Date &amp; Time</label>
            <input id="endDate" name="endDate" type="datetime-local" className={styles.input} />
          </div>
        </div>
      </div>

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Location</h2>

        {/* Venue name */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="addressName">Venue Name</label>
          <input
            id="addressName" name="addressName" type="text"
            className={styles.input}
            placeholder="e.g. Zilker Park, Convention Center"
          />
        </div>

        {/* Street address */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="address">Street Address *</label>
          <input
            id="address" name="address" type="text"
            className={styles.input}
            placeholder="123 Main St"
            required
          />
          {state?.fieldErrors?.address && <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.address}</p>}
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="city">City *</label>
            <input
              id="city" name="city" type="text"
              className={styles.input}
              placeholder="Austin"
              required
            />
            {state?.fieldErrors?.city && <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.city}</p>}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="state">State</label>
            <input id="state" name="state" type="text" className={styles.input} defaultValue="TX" />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="zipCode">ZIP Code *</label>
          <input
            id="zipCode" name="zipCode" type="text"
            className={styles.input}
            placeholder="78701"
            required
          />
          {state?.fieldErrors?.zipCode && <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.zipCode}</p>}
        </div>
      </div>

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Additional Info</h2>

        {/* Link to business */}
        {businesses.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="businessId">Link to Your Business Listing *</label>
            <select id="businessId" name="businessId" className={styles.select} required>
              <option value="">Select your business</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {state?.fieldErrors?.businessId ? (
              <p style={{ color: "var(--retro-red)", fontSize: "0.85rem" }}>{state.fieldErrors.businessId}</p>
            ) : null}
          </div>
        )}

        {/* Tags */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="tags">Tags (optional)</label>
          <input
            id="tags" name="tags" type="text"
            className={styles.input}
            placeholder="music, food, family, outdoor"
          />
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            Separate tags with commas. Tags help people find your event.
          </p>
        </div>
      </div>

      <div className={styles.formNavigation}>
        <button type="submit" className={styles.buttonPrimary} disabled={isPending}>
          {isPending ? "Submitting..." : "Submit Event For Review"}
        </button>
      </div>
    </form>
  );
}
