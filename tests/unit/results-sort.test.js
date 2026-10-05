import { describe, expect, it } from "vitest";
import { normalizeSort, resultOrderBy, sortResults } from "@/lib/results-sort";
const rows = [{ id: "b", name: "alpha", createdAt: "2026-01-01", savedAt: "2026-04-01" }, { id: "a", name: "Alpha", createdAt: "2026-01-01", savedAt: "2026-03-01" }, { id: "c", name: "Zebra", createdAt: "2026-02-01", savedAt: "2026-02-01" }];
describe("shared result ordering", () => {
  it.each([["newest", ["c", "a", "b"]], ["oldest", ["a", "b", "c"]], ["name-asc", ["a", "b", "c"]], ["name-desc", ["c", "a", "b"]]])("%s is stable for matching dates and mixed case names", (sort, ids) => {
    expect(sortResults(rows, sort).map((row) => row.id)).toEqual(ids);
    expect(rows[0].id).toBe("b");
  });
  it("uses saved dates independently of listing creation dates", () => {
    expect(sortResults(rows, "newest", { date: (row) => row.savedAt }).map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(sortResults(rows, "oldest", { date: (row) => row.savedAt }).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });
  it("limits special sorts to their supported pages", () => {
    expect(normalizeSort("popular")).toBe("newest");
    expect(normalizeSort("city")).toBe("newest");
    expect(normalizeSort("city", "newest", ["city"])).toBe("city");
    expect(normalizeSort("upcoming", "city", ["city"])).toBe("city");
    expect(normalizeSort("anything", "upcoming", ["upcoming"])).toBe("upcoming");
    expect(resultOrderBy("name-desc", { name: "sortName" })).toEqual([{ sortName: "desc" }, { id: "asc" }]);
  });
  it("sorts business city relations and event city names alphabetically with stable ties", () => {
    const businesses = [{ id: "c", city: { name: "Dallas" } }, { id: "b", city: { name: "austin" } }, { id: "a", city: { name: "Austin" } }];
    expect(sortResults(businesses, "city", { extras: ["city"] }).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(resultOrderBy("city", { cityOrderBy: { city: { name: "asc" } }, extras: ["city"] })).toEqual([{ city: { name: "asc" } }, { id: "asc" }]);
    const events = [{ id: "d", city: "Dallas", startDate: "2030-01-01" }, { id: "a", city: "Austin", startDate: "2030-01-03" }, { id: "b", city: "Austin", startDate: "2030-01-02" }];
    expect(sortResults(events, "city", { cityDate: (event) => event.startDate, extras: ["city"] }).map((row) => row.id)).toEqual(["b", "a", "d"]);
    expect(resultOrderBy("city", { cityDate: "startDate", extras: ["city"] })).toEqual([{ city: "asc" }, { startDate: "asc" }, { id: "asc" }]);
  });
});
