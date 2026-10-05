import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
    },
  },
}));

import { filterEvents, getEventById, getPublishedEventCityNames, getPublishedEvents } from "@/lib/events";

const event = {
  id: "event-1",
  title: "Community Market",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  description: "A neighborhood market.",
  imageUrl: null,
  eventUrl: null,
  addressName: "Town Square",
  address: "100 Main Street",
  city: "Austin",
  state: "TX",
  startDate: new Date("2030-01-10T16:00:00Z"),
  endDate: new Date("2030-01-10T18:00:00Z"),
  timezone: "America/Chicago",
  tags: [{ name: "Community", slug: "community" }],
  business: { name: "Town Hall", slug: "town-hall" },
};

function missingColumnError() {
  return Object.assign(
    new Error("The column `(not available)` does not exist in the current database."),
    { code: "P2022" }
  );
}

describe("event schema compatibility", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.findFirst.mockReset();
  });

  it("exposes and filters all selected categories while keeping marker text out of public tags", async () => {
    mocks.findMany.mockResolvedValue([{ ...event, category: { id: "community", name: "Community", slug: "community" }, tags: [
      { name: "Event Category: Outdoor", slug: "outdoor-marker" },
      { name: "Event Category: Food & Drink", slug: "food-marker" },
      { name: "Free Admission", slug: "free" },
    ] }]);
    const events = await getPublishedEvents();
    expect(events[0].categoryTags.map((category) => category.name)).toEqual(["Community", "Outdoor", "Food & Drink"]);
    expect(events[0].tags).toEqual(["Community", "Outdoor", "Food & Drink", "Free Admission"]);
    expect(filterEvents(events, { category: "Outdoor" })).toHaveLength(1);
    expect(filterEvents(events, { category: "Food & Drink" })).toHaveLength(1);
    expect(filterEvents(events, { category: "Live Music" })).toHaveLength(0);
  });

  it("loads non-recurring events from a database without recurrence or soft-delete columns", async () => {
    mocks.findMany
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockResolvedValueOnce([event]);

    const result = await getPublishedEvents();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "event-1", recurrence: "NONE" });
    expect(mocks.findMany).toHaveBeenCalledTimes(5);

    const legacyQuery = mocks.findMany.mock.calls[4][0];
    expect(JSON.stringify(legacyQuery.where)).not.toContain("recurrence");
    expect(JSON.stringify(legacyQuery.where)).not.toContain("deletedAt");
    expect(legacyQuery.select).not.toHaveProperty("recurrence");
    expect(legacyQuery.select).not.toHaveProperty("recurrenceUntil");
  });

  it("loads an event detail through the same compatibility fallback", async () => {
    mocks.findFirst
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockResolvedValueOnce(event);

    const result = await getEventById("event-1");

    expect(result).toMatchObject({ id: "event-1", recurrence: "NONE" });
    expect(mocks.findFirst).toHaveBeenCalledTimes(4);

    const legacyQuery = mocks.findFirst.mock.calls[3][0];
    expect(JSON.stringify(legacyQuery.where)).not.toContain("recurrence");
    expect(JSON.stringify(legacyQuery.where)).not.toContain("deletedAt");
    expect(legacyQuery.select).not.toHaveProperty("recurrence");
    expect(legacyQuery.select).not.toHaveProperty("recurrenceUntil");
  });

  it("loads event city names for business results through the legacy schema fallback", async () => {
    mocks.findMany
      .mockRejectedValueOnce(missingColumnError())
      .mockRejectedValueOnce(missingColumnError())
      .mockResolvedValueOnce([
        { city: "Dallas" },
        { city: "Austin" },
        { city: "Austin" },
      ]);

    const result = await getPublishedEventCityNames();

    expect(result).toEqual(["Austin", "Dallas"]);
    expect(mocks.findMany).toHaveBeenCalledTimes(3);

    const legacyQuery = mocks.findMany.mock.calls[2][0];
    expect(JSON.stringify(legacyQuery.where)).not.toContain("recurrence");
    expect(JSON.stringify(legacyQuery.where)).not.toContain("deletedAt");
    expect(legacyQuery).toMatchObject({
      distinct: ["city"],
      select: { city: true },
    });
  });
});
