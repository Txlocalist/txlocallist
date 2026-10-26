import { describe, expect, it } from "vitest";
import { getActiveOffers, getActiveOfferWhere, getOfferDateKey, getOfferStatus, normalizeBusinessOffers } from "@/lib/business-offers";

const offer = { headline: "20% off", description: "A neighborhood special.", instructions: "Show this at checkout.", enabled: true };

describe("business offers", () => {
  it("normalizes only supported fields, preserves omission, and supports removing all offers", () => {
    expect(normalizeBusinessOffers(undefined)).toBeUndefined();
    expect(normalizeBusinessOffers([])).toEqual([]);
    expect(normalizeBusinessOffers([{ ...offer, headline: " 20% off ", code: " LOCAL20 ", businessId: "another-owner", id: "injected", order: 9 }])[0])
      .toEqual({ ...offer, headline: "20% off", code: "LOCAL20", terms: null, startDate: null, endDate: null, order: 0 });
  });
  it.each([null, {}, [null], ["offer"], Array(4).fill(offer), [{ ...offer, instructions: " " }], [{ ...offer, headline: "x".repeat(101) }], [{ ...offer, enabled: "false" }], [{ ...offer, startDate: "2026-02-30" }], [{ ...offer, startDate: "2026-2-01" }], [{ ...offer, startDate: "2026-10-27", endDate: "2026-10-26" }]])("rejects invalid input %#", (input) => {
    expect(() => normalizeBusinessOffers(input)).toThrow();
  });
  it("derives paused, scheduled, expired and ongoing status without a background job", () => {
    const today = "2026-10-26";
    expect(getOfferStatus(offer, today)).toBe("Active");
    expect(getOfferStatus({ ...offer, enabled: false }, today)).toBe("Paused");
    expect(getOfferStatus({ ...offer, startDate: "2026-10-27" }, today)).toBe("Scheduled");
    expect(getOfferStatus({ ...offer, endDate: "2026-10-25" }, today)).toBe("Expired");
    expect(getActiveOffers([offer, { ...offer, enabled: false }, { ...offer, startDate: "2026-10-27" }], today)).toEqual([offer]);
  });
  it.each([
    ["2026-03-08T05:59:59Z", "2026-03-07"],
    ["2026-03-08T06:00:00Z", "2026-03-08"],
    ["2026-03-09T04:59:59Z", "2026-03-08"],
    ["2026-03-09T05:00:00Z", "2026-03-09"],
    ["2026-11-01T04:59:59Z", "2026-10-31"],
    ["2026-11-01T05:00:00Z", "2026-11-01"],
    ["2026-11-02T05:59:59Z", "2026-11-01"],
    ["2026-11-02T06:00:00Z", "2026-11-02"],
  ])("uses Central calendar days across DST: %s", (instant, day) => {
    expect(getOfferDateKey(new Date(instant))).toBe(day);
  });
  it("includes both boundaries of a same-day offer and uses inclusive query predicates", () => {
    const sameDay = { ...offer, startDate: "2026-03-08", endDate: "2026-03-08" };
    expect(getOfferStatus(sameDay, getOfferDateKey(new Date("2026-03-08T06:00:00Z")))).toBe("Active");
    expect(getOfferStatus(sameDay, getOfferDateKey(new Date("2026-03-09T04:59:59Z")))).toBe("Active");
    expect(getOfferStatus(sameDay, getOfferDateKey(new Date("2026-03-09T05:00:00Z")))).toBe("Expired");
    expect(getActiveOfferWhere("2026-03-08")).toEqual({ enabled: true, AND: [
      { OR: [{ startDate: null }, { startDate: { lte: "2026-03-08" } }] },
      { OR: [{ endDate: null }, { endDate: { gte: "2026-03-08" } }] },
    ] });
  });
});
