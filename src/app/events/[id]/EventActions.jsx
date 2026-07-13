"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

function escapeCalendarText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toCalendarDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function calendarFileName(title) {
  const safeTitle = String(title || "texas-localist-event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safeTitle || "texas-localist-event"}.ics`;
}

export default function EventActions({
  eventId,
  initialSaved = false,
  initialCount = 0,
  isLoggedIn = false,
  event,
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function toggleSave() {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const previousSaved = saved;
    const previousCount = count;
    const nextSaved = !previousSaved;

    setLoading(true);
    setFeedback("");
    setSaved(nextSaved);
    setCount(Math.max(0, previousCount + (nextSaved ? 1 : -1)));

    try {
      const response = await fetch("/api/event-favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update your saved events.");
      }

      setSaved(data.saved);
      setCount(data.count);
      setFeedback(data.saved ? "Event saved." : "Event removed from saved events.");
      router.refresh();
    } catch (error) {
      setSaved(previousSaved);
      setCount(previousCount);
      setFeedback(error.message || "Unable to update your saved events.");
    } finally {
      setLoading(false);
    }
  }

  async function shareEvent() {
    const shareData = {
      title: event.title,
      text: event.description,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setFeedback("Share sheet opened.");
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setFeedback("Event link copied.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        setFeedback("Copy the event URL from your browser to share it.");
      }
    }
  }

  function addToCalendar() {
    if (!event.startDate) return;

    const startDate = new Date(event.startDate);
    const endDate = event.endDate
      ? new Date(event.endDate)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const location = [event.venue, event.address, event.cityLabel].filter(Boolean).join(", ");
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Texas Localist//Event Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${eventId}@txlocalist.com`,
      `DTSTAMP:${toCalendarDate(new Date())}`,
      `DTSTART:${toCalendarDate(startDate)}`,
      `DTEND:${toCalendarDate(endDate)}`,
      `SUMMARY:${escapeCalendarText(event.title)}`,
      `DESCRIPTION:${escapeCalendarText(event.description)}`,
      `LOCATION:${escapeCalendarText(location)}`,
      `URL:${escapeCalendarText(window.location.href)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = calendarFileName(event.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback("Calendar file downloaded.");
  }

  const savedCopy = count > 0
    ? `${count.toLocaleString()} ${count === 1 ? "local has" : "locals have"} saved this event`
    : "Be the first local to save this event";

  return (
    <div className={styles.actionsArea}>
      <div className={styles.actionButtons}>
        <button
          type="button"
          onClick={toggleSave}
          disabled={loading}
          aria-pressed={saved}
          className={`${styles.actionButton} ${saved ? styles.actionButtonSaved : ""}`}
        >
          <span className="material-icons" aria-hidden="true">
            {saved ? "favorite" : "favorite_border"}
          </span>
          {loading ? "Saving" : saved ? "Saved" : "Save"}
        </button>

        <button type="button" onClick={shareEvent} className={styles.actionButton}>
          <span className="material-icons" aria-hidden="true">share</span>
          Share
        </button>

        <button
          type="button"
          onClick={addToCalendar}
          disabled={!event.startDate}
          className={`${styles.actionButton} ${styles.calendarButton}`}
        >
          <span className="material-icons" aria-hidden="true">calendar_month</span>
          Add to Calendar
        </button>
      </div>

      <div className={styles.savedPanel}>
        <div className={styles.avatarStack} aria-hidden="true">
          <span>TX</span>
          <span>LOC</span>
          <span>ATX</span>
        </div>
        <p aria-live="polite">{savedCopy}</p>
      </div>

      <p className={styles.actionFeedback} role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}
