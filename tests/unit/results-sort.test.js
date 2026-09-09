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
    expect(normalizeSort("anything", "upcoming", ["upcoming"])).toBe("upcoming");
    expect(resultOrderBy("name-desc", { name: "sortName" })).toEqual([{ sortName: "desc" }, { id: "asc" }]);
  });
});
