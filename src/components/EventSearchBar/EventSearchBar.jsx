"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./EventSearchBar.module.css";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateLabel(value) {
  if (value === "today") return "Today";
  if (value === "tomorrow") return "Tomorrow";
  if (value === "this-weekend") return "This Weekend";
  if (value === "next-7-days") return "Next 7 Days";
  const date = dateFromKey(value);
  return date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "All Dates";
}

export default function EventSearchBar({
  initialQuery = "",
  initialLocation = "",
  initialDate = "this-weekend",
  onSearch,
}) {
  const router = useRouter();
  const popoverRef = useRef(null);
  const dateFieldRef = useRef(null);
  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [date, setDate] = useState(initialDate);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const selected = dateFromKey(initialDate) || new Date();
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });

  useEffect(() => {
    if (!popoverOpen) return undefined;

    function handlePointerDown(event) {
      if (
        !popoverRef.current?.contains(event.target) &&
        !dateFieldRef.current?.contains(event.target)
      ) {
        setPopoverOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setPopoverOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [popoverOpen]);

  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const leadingDays = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: leadingDays }, (_, index) => ({
      key: `blank-${index}`,
      blank: true,
    }));

    for (let day = 1; day <= daysInMonth; day += 1) {
      const value = new Date(year, month, day);
      cells.push({ key: dateKey(value), day, value });
    }

    return cells;
  }, [viewMonth]);

  function chooseDate(value) {
    setDate(value);
    const selected = dateFromKey(value);
    if (selected) {
      setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    setPopoverOpen(false);
  }

  function submit(event) {
    event.preventDefault();
    const values = {
      query: query.trim(),
      location: location.trim(),
      date,
    };

    if (onSearch) {
      onSearch(values);
      return;
    }

    const params = new URLSearchParams();
    if (values.query) params.set("q", values.query);
    if (values.location) params.set("loc", values.location);
    if (values.date) params.set("date", values.date);
    router.push(`/events/results${params.size ? `?${params.toString()}` : ""}`);
  }

  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const today = dateKey(new Date());

  return (
    <form className={styles.search} onSubmit={submit} aria-label="Search local happenings">
      <label className={styles.field}>
        <span className="material-icons" aria-hidden="true">search</span>
        <span className="sr-only">Search</span>
        <input
          type="search"
          placeholder="Search artists, venues, festivals..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className="material-icons" aria-hidden="true">location_on</span>
        <span className="sr-only">City</span>
        <input
          type="text"
          placeholder="City"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </label>

      <div className={`${styles.field} ${styles.dateField}`} ref={dateFieldRef}>
        <button
          className={styles.dateTrigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          onClick={() => setPopoverOpen((open) => !open)}
        >
          <span className="material-icons" aria-hidden="true">calendar_month</span>
          <span>{dateLabel(date)}</span>
          <span className="material-icons" aria-hidden="true">expand_more</span>
        </button>

        <div
          className={`${styles.popover} ${popoverOpen ? styles.popoverOpen : ""}`}
          role="dialog"
          aria-label="Choose event date"
          ref={popoverRef}
        >
          <div className={styles.quickDates} aria-label="Quick date choices">
            {[
              ["", "All Dates"],
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["this-weekend", "This Weekend"],
              ["next-7-days", "Next 7 Days"],
            ].map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                className={date === value ? styles.quickDateActive : styles.quickDate}
                onClick={() => chooseDate(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.calendar}>
            <div className={styles.calendarHead}>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                <span className="material-icons" aria-hidden="true">chevron_left</span>
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                <span className="material-icons" aria-hidden="true">chevron_right</span>
              </button>
            </div>
            <div className={styles.calendarGrid}>
              {DAY_NAMES.map((name) => (
                <span key={name} className={styles.dayName}>{name}</span>
              ))}
              {calendarCells.map((cell) =>
                cell.blank ? (
                  <span key={cell.key} className={styles.blankDay} />
                ) : (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      styles.day,
                      cell.key === today ? styles.today : "",
                      cell.key === date ? styles.selectedDay : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => chooseDate(cell.key)}
                    aria-pressed={cell.key === date}
                  >
                    {cell.day}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <button className={styles.submit} type="submit">Search</button>
    </form>
  );
}
