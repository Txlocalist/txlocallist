import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { event: mocks } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));

import { GET } from "@/app/api/events/route";

function event(id, city, startDate, recurrence = "NONE") {
  const start = new Date(startDate);
  return { id, city, startDate: start, endDate: new Date(+start + 3_600_000), timezone: "America/Chicago", recurrence, recurrenceUntil: null };
}

const singles = [
  event("a-early", "Austin", "2030-01-02T16:00:00Z"),
  event("a-late", "Austin", "2030-01-04T16:00:00Z"),
  event("d-first", "Dallas", "2030-01-01T16:00:00Z"),
  event("d-last", "Dallas", "2030-01-04T16:00:00Z"),
  event("t-first", "Tyler", "2030-01-01T16:00:00Z"),
];
const recurring = [
  event("a-weekly", "Austin", "2020-01-02T16:00:00Z", "WEEKLY"),
  event("d-weekly", "Dallas", "2020-01-02T16:00:00Z", "WEEKLY"),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  mocks.count.mockResolvedValue(singles.length);
  mocks.findMany.mockImplementation(async ({ where, skip = 0, take }) => {
    const rows = where.recurrence === "WEEKLY" ? recurring : singles;
    return rows.slice(skip, take === undefined ? undefined : skip + take);
  });
});
afterEach(() => vi.useRealTimers());

describe("event city ordering", () => {
  it("keeps recurring next occurrences in chronological order within each city across pages", async () => {
    const pages = [];
    for (let page = 1; page <= 4; page += 1) {
      const response = await GET(new Request(`http://localhost/api/events?sort=city&limit=2&page=${page}`));
      const body = await response.json();
      expect(body).toMatchObject({ total: 7, page, pageSize: 2, hasMore: page < 4 });
      pages.push(...body.events);
    }
    expect(pages.map((row) => row.id)).toEqual(["a-early", "a-weekly", "a-late", "d-first", "d-weekly", "d-last", "t-first"]);
    expect(pages.find((row) => row.id === "a-weekly").startDate).toBe("2030-01-03T16:00:00.000Z");
    for (const [query] of mocks.findMany.mock.calls) {
      expect(query.orderBy).toEqual([{ city: "asc" }, { startDate: "asc" }, { id: "asc" }]);
    }
    expect(mocks.findMany.mock.calls.filter(([query]) => query.where.recurrence === "NONE").map(([query]) => query.take)).toEqual([4, 4, 4, 4]);
  });
});
