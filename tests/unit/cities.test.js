import { describe, expect, it } from "vitest";
import { normalizeCityInput, mergeCityNames, mergeEventCityLabels } from "@/lib/cities";
describe("managed cities", () => {
  it.each(["", "A", "Austin, CA", "Austin123", "<script>", "A".repeat(101), null])("rejects invalid name %s", (name) => expect(normalizeCityInput(name).error).toBeTruthy());
  it("normalizes whitespace, apostrophes and accented slugs", () => {
    expect(normalizeCityInput("  San   José ")).toEqual({ name: "San José", slug: "san-jose", state: "Texas" });
    expect(normalizeCityInput("O’Donnell").slug).toBe("o-donnell");
  });
  it("includes empty managed cities and deduplicates event cities", () => {
    expect(mergeCityNames(["Austin", "Empty Town"], [" austin "])).toEqual(["Austin", "Empty Town"]);
    expect(mergeEventCityLabels([{ name: "Empty Town", state: "Texas" }, { name: "Austin", state: "Texas" }], [{ city: "austin", state: "TX" }])).toEqual(["Austin, TX", "Empty Town, TX"]);
  });
});
