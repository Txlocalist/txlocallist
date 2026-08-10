"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createEventAction, updateEventAction } from "@/app/actions/events";
import { PhotoUploader } from "@/components/PhotoUploader";
import { EVENT_CATEGORIES } from "@/lib/event-categories.mjs";

import styles from "./form.module.css";

const INITIAL_STATE = { error: null, fieldErrors: {} };

function FieldError({ id, message }) {
  return message ? <p id={id} className={styles.fieldError}>{message}</p> : null;
}

function errorAttributes(fieldErrors, field) {
  return fieldErrors[field]
    ? { "aria-invalid": true, "aria-describedby": `${field}-error` }
    : {};
}
export function CreateEventForm({
  businesses = [],
  hasMembership = false,
  isAdmin = false,
  oneTimePostingEnabled = false,
  eventPostPrice,
  initialEvent = null,
  mode = "create",
}) {
  const action = mode === "edit" ? updateEventAction : createEventAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [photos, setPhotos] = useState(
    initialEvent?.imageUrl
      ? [{ url: initialEvent.imageUrl, name: `${initialEvent.title} cover image` }]
      : [],
  );
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const isEditing = mode === "edit";
  const fieldErrors = state?.fieldErrors ?? {};
  const hasCoveredBusiness = hasMembership && businesses.length > 0;
  const defaultBusinessId = initialEvent?.businessId ?? (
    !isEditing && hasCoveredBusiness ? businesses[0].id : ""
  );

  const postingNotice = isAdmin
    ? "Admin event posts go directly to review without a separate charge."
    : hasCoveredBusiness
      ? oneTimePostingEnabled
        ? `Your membership will use ${businesses[0].name} by default. Choose the standalone option only if you want a separate ${eventPostPrice} Checkout.`
        : `Your membership will use ${businesses[0].name} by default. Standalone one-time Checkout is currently paused.`
      : hasMembership
        ? `Your membership covers events linked to an active business. No active business is available, so this post uses ${eventPostPrice} Checkout.`
        : `Standalone event posts cost ${eventPostPrice} once. Secure Stripe Checkout starts before admin review.`;

  return (
    <form action={formAction} className={styles.form}>
      {initialEvent?.id ? <input type="hidden" name="eventId" value={initialEvent.id} /> : null}

      {state?.error ? (
        <div className={styles.errorMessage} role="alert">
          <p>{state.error}</p>
          {state.retryPath ? <Link href={state.retryPath}>Open My Events</Link> : null}
        </div>
      ) : null}

      {!isEditing ? (
        <div className={styles.paymentNotice}>
          <strong>How posting works</strong>
          <p>{postingNotice}</p>
        </div>
      ) : (
        <div className={styles.paymentNotice}>
          Published event changes return to admin review. Your original payment stays attached to this event.
        </div>
      )}

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Event Details</h2>
        <p className={styles.stepDescription}>Tell people what is happening, where, and when.</p>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="category">Event Category *</label>
          <select
            id="category"
            name="category"
            className={styles.select}
            defaultValue={initialEvent?.category ?? ""}
            required
            {...errorAttributes(fieldErrors, "category")}
          >
            <option value="" disabled>Select a category</option>
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <FieldError id="category-error" message={fieldErrors.category} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="title">Event Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            className={styles.input}
            placeholder="Austin Farmers Market"
            defaultValue={initialEvent?.title ?? ""}
            minLength={3}
            maxLength={120}
            required
            {...errorAttributes(fieldErrors, "title")}
          />
          <FieldError id="title-error" message={fieldErrors.title} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="description">Description *</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className={styles.textarea}
            placeholder="Tell people what the event includes."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            minLength={20}
            maxLength={300}
            required
            {...errorAttributes(fieldErrors, "description")}
          />
          <div className={styles.descriptionMeta}>
            {fieldErrors.description ? (
              <FieldError id="description-error" message={fieldErrors.description} />
            ) : (
              <span>Keep it useful and concise.</span>
            )}
            <span aria-live="polite">{description.length}/300</span>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Cover Image</label>
          <input type="hidden" name="imageUrl" value={photos[0]?.url || ""} />
          <PhotoUploader
            photos={photos}
            onChange={setPhotos}
            maxPhotos={1}
            uploadEndpoint="/api/event-images/upload"
            acceptedTypes="image/jpeg,image/png,image/webp"
            supportedTypesLabel="JPG, PNG, and WEBP"
            limitMessage="One event cover image is allowed."
          />
          <p className={styles.uploadHint}>Add one optional raster cover image.</p>
          <FieldError id="imageUrl-error" message={fieldErrors.imageUrl} />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="startDate">Start Date &amp; Time *</label>
            <input
              id="startDate"
              name="startDate"
              type="datetime-local"
              className={styles.input}
              defaultValue={initialEvent?.startDate ?? ""}
              required
              {...errorAttributes(fieldErrors, "startDate")}
            />
            <FieldError id="startDate-error" message={fieldErrors.startDate} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="endDate">End Date &amp; Time *</label>
            <input
              id="endDate"
              name="endDate"
              type="datetime-local"
              className={styles.input}
              defaultValue={initialEvent?.endDate ?? ""}
              required
              {...errorAttributes(fieldErrors, "endDate")}
            />
            <FieldError id="endDate-error" message={fieldErrors.endDate} />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="timezone">Time Zone *</label>
          <select
            id="timezone"
            name="timezone"
            className={styles.select}
            defaultValue={initialEvent?.timezone ?? "America/Chicago"}
            required
          >
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
          </select>
          <p className={styles.helpText}>Choose the time zone where the event takes place.</p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="eventUrl">Event or Ticket Link</label>
          <input
            id="eventUrl"
            name="eventUrl"
            type="url"
            inputMode="url"
            className={styles.input}
            placeholder="https://example.com/tickets"
            defaultValue={initialEvent?.eventUrl ?? ""}
            {...errorAttributes(fieldErrors, "eventUrl")}
          />
          <FieldError id="eventUrl-error" message={fieldErrors.eventUrl} />
        </div>
      </div>

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Location</h2>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="addressName">Venue Name</label>
          <input
            id="addressName"
            name="addressName"
            type="text"
            className={styles.input}
            placeholder="Zilker Park"
            defaultValue={initialEvent?.addressName ?? ""}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="address">Street Address *</label>
          <input
            id="address"
            name="address"
            type="text"
            className={styles.input}
            placeholder="123 Main St"
            defaultValue={initialEvent?.address ?? ""}
            required
            {...errorAttributes(fieldErrors, "address")}
          />
          <FieldError id="address-error" message={fieldErrors.address} />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="city">City *</label>
            <input
              id="city"
              name="city"
              type="text"
              className={styles.input}
              placeholder="Austin"
              defaultValue={initialEvent?.city ?? ""}
              required
              {...errorAttributes(fieldErrors, "city")}
            />
            <FieldError id="city-error" message={fieldErrors.city} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="state">State *</label>
            <input
              id="state"
              name="state"
              type="text"
              className={styles.input}
              defaultValue={initialEvent?.state ?? "TX"}
              required
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="zipCode">ZIP Code *</label>
          <input
            id="zipCode"
            name="zipCode"
            type="text"
            inputMode="numeric"
            className={styles.input}
            placeholder="78701"
            defaultValue={initialEvent?.zipCode ?? ""}
            required
            {...errorAttributes(fieldErrors, "zipCode")}
          />
          <FieldError id="zipCode-error" message={fieldErrors.zipCode} />
        </div>
      </div>

      <div className={styles.step}>
        <h2 className={styles.stepTitle}>Additional Info</h2>

        {businesses.length > 0 ? (
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="businessId">Posting Option</label>
            <select
              id="businessId"
              name="businessId"
              className={styles.select}
              defaultValue={defaultBusinessId}
              {...errorAttributes(fieldErrors, "businessId")}
            >
              {oneTimePostingEnabled || isEditing ? (
                <option value="">Standalone event ({eventPostPrice} one time)</option>
              ) : null}
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {hasMembership ? `Use membership: ${business.name}` : `Link ${business.name}`}
                </option>
              ))}
            </select>
            <p className={styles.helpText}>
              Active members can link an owned business to include event posting with membership.
            </p>
          <FieldError id="businessId-error" message={fieldErrors.businessId} />
          </div>
        ) : null}

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            type="text"
            className={styles.input}
            placeholder="music, food, family, outdoor"
            defaultValue={initialEvent?.tags ?? ""}
          />
          <p className={styles.helpText}>Separate up to 10 tags with commas.</p>
        </div>
      </div>

      <div className={styles.formNavigation}>
        <button type="submit" className={styles.buttonPrimary} disabled={isPending}>
          {isPending
            ? isEditing ? "Saving..." : "Continuing..."
            : isEditing ? "Save Changes" : "Continue"}
        </button>
      </div>
    </form>
  );
}
