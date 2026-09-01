import { describe, expect, test } from "vitest";

import {
  getEventCalendarDayCount,
  getInclusiveEventDateKeys,
} from "@/lib/event-dates";
import {
  parseOrganizerDateTimeLocal,
  validateOrganizerEventDateRange,
} from "@/lib/event-dates.server";

const TEST_NOW = new Date("2025-01-01T00:00:00.000Z");

function validateRange(startDate, endDate, timeZone = "America/Chicago") {
  return validateOrganizerEventDateRange({
    startDate,
    endDate,
    timeZone,
    now: TEST_NOW,
  });
}

describe("organizer event dates", () => {
  test("converts Central and Mountain wall times to their correct UTC instants", () => {
    expect(
      parseOrganizerDateTimeLocal("2026-08-10T09:00", "America/Chicago").toISOString()
    ).toBe("2026-08-10T14:00:00.000Z");
    expect(
      parseOrganizerDateTimeLocal("2026-08-10T09:00", "America/Denver").toISOString()
    ).toBe("2026-08-10T15:00:00.000Z");
  });

  test("accepts a one-day event", () => {
    const result = validateRange("2026-08-10T09:00", "2026-08-10T17:00");

    expect(result.dateKeys).toEqual(["2026-08-10"]);
    expect(getEventCalendarDayCount(result.startDate, result.endDate, result.timezone)).toBe(1);
  });

  test("counts five local calendar days across a daylight-saving transition", () => {
    const result = validateRange("2026-03-06T09:00", "2026-03-10T17:00");

    expect(result.dateKeys).toEqual([
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ]);
    expect(getInclusiveEventDateKeys(
      result.startDate,
      result.endDate,
      result.timezone
    )).toHaveLength(5);
  });

  test("accepts 30 inclusive calendar days", () => {
    const result = validateRange("2026-01-01T09:00", "2026-01-30T17:00");

    expect(result.dateKeys).toHaveLength(30);
    expect(result.dateKeys.at(0)).toBe("2026-01-01");
    expect(result.dateKeys.at(-1)).toBe("2026-01-30");
  });

  test("rejects 31 inclusive calendar days", () => {
    expect(() =>
      validateRange("2026-01-01T09:00", "2026-01-31T17:00")
    ).toThrow("Events can span no more than 30 calendar days.");
  });

  test.each([
    "America/Chicago",
    "America/Denver",
  ])("rejects a nonexistent spring-forward time in %s", (timeZone) => {
    expect(() =>
      parseOrganizerDateTimeLocal("2026-03-08T02:30", timeZone)
    ).toThrow("That local time does not exist because of daylight saving time.");
  });
});
