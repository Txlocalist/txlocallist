import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { getEventOccurrences, getNextEventOccurrence, getRecurrenceLabel, getRecurrenceUntilInput, validateEventRecurrence } from "@/lib/event-recurrence";
import { isEventPast } from "@/lib/event-dates";
import { validateOrganizerEventDateRange } from "@/lib/event-dates.server";

const schedule = (startDate, endDate, timezone = "America/Chicago") => validateOrganizerEventDateRange({ startDate, endDate, timeZone: timezone, now: new Date("2025-01-01") });
const weekly = (start = "2026-03-06T19:00", end = "2026-03-06T22:00", zone) => ({ ...schedule(start, end, zone), recurrence: "WEEKLY", recurrenceUntil: null });

describe("weekly event schedules", () => {
  it.each(["America/Chicago", "America/Denver"])("keeps Friday at 7pm through DST in %s", (zone) => {
    const event = weekly(undefined, undefined, zone);
    const dates = getEventOccurrences(event, { now: new Date("2026-03-01"), limit: 3 });
    expect(dates.map((date) => formatInTimeZone(date.startDate, zone, "EEE HH:mm"))).toEqual(["Fri 19:00", "Fri 19:00", "Fri 19:00"]);
    expect(dates[1].startDate - dates[0].startDate).toBe(167 * 3600000);
    expect(getRecurrenceLabel(event)).toBe("Every Friday");
  });
  it("keeps the overnight occurrence until its end, then advances a week", () => {
    const event = weekly("2026-09-11T22:00", "2026-09-12T02:00");
    expect(getNextEventOccurrence(event, new Date("2026-09-12T06:00Z")).startDate.toISOString()).toBe("2026-09-12T03:00:00.000Z");
    expect(getNextEventOccurrence(event, new Date("2026-09-12T07:01Z")).startDate.toISOString()).toBe("2026-09-19T03:00:00.000Z");
  });
  it("remains discoverable years after its anchor without materializing past weeks", () => {
    const event = weekly();
    expect(isEventPast(event, new Date("2032-08-01"))).toBe(false);
    expect(getEventOccurrences(event, { now: new Date("2032-08-01"), limit: 10000 })).toHaveLength(54);
  });
  it("honors an inclusive final occurrence even when it ends the next day", () => {
    const event = weekly("2026-09-11T22:00", "2026-09-12T02:00");
    Object.assign(event, validateEventRecurrence({ recurrence: "WEEKLY", until: "2026-09-18", schedule: event, now: new Date("2026-09-01") }));
    expect(getRecurrenceUntilInput(event)).toBe("2026-09-18");
    expect(getNextEventOccurrence(event, new Date("2026-09-19T06:00Z"))).not.toBeNull();
    expect(getNextEventOccurrence(event, new Date("2026-09-19T07:01Z"))).toBeNull();
    expect(isEventPast(event, new Date("2026-09-20"))).toBe(true);
  });
  it("skips nonexistent spring-forward occurrences rather than shifting the event time", () => {
    const event = weekly("2026-03-01T02:30", "2026-03-01T04:00");
    const next = getNextEventOccurrence(event, new Date("2026-03-02"));
    expect(formatInTimeZone(next.startDate, event.timezone, "yyyy-MM-dd HH:mm")).toBe("2026-03-15 02:30");
  });
  it("preserves local time when clocks fall back", () => {
    const dates = getEventOccurrences(weekly("2026-10-30T19:00", "2026-10-30T22:00"), { now: new Date("2026-10-29"), limit: 2 });
    expect(dates[1].startDate - dates[0].startDate).toBe(169 * 3600000);
  });
  it("rejects invalid rules, overlapping weeks, wrong weekdays and expired series", () => {
    const event = weekly();
    expect(() => validateEventRecurrence({ recurrence: "DAILY", schedule: event })).toThrow("valid repeat");
    expect(() => validateEventRecurrence({ recurrence: "WEEKLY", until: "2026-03-07", schedule: event })).toThrow("same weekday");
    expect(() => validateEventRecurrence({ recurrence: "WEEKLY", until: "2026-02-30", schedule: event })).toThrow("valid last occurrence");
    expect(() => validateEventRecurrence({ recurrence: "WEEKLY", until: "2026-03-13", schedule: event, now: new Date("2026-04-01") })).toThrow("upcoming");
    expect(() => validateEventRecurrence({ recurrence: "WEEKLY", schedule: schedule("2026-03-06T19:00", "2026-03-13T19:00") })).toThrow("next week");
  });
  it("clears the repeat end date when recurrence is disabled", () => {
    expect(validateEventRecurrence({ recurrence: "NONE", until: "2026-09-18", schedule: weekly() })).toEqual({ recurrence: "NONE", recurrenceUntil: null });
  });
});
