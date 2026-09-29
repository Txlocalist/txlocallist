import { describe, expect, it } from "vitest";
import { normalizeCategoryInput } from "@/lib/categories";
import { fromEventCategoryTagName, isEventCategoryTagName } from "@/lib/event-categories.mjs";

describe("managed categories", () => {
  it.each(["", "A", null, "<script>", "A".repeat(101)])("rejects invalid category %s", (name) => {
    expect(normalizeCategoryInput(name).error).toBeTruthy();
  });
  it("normalizes names and readable slugs", () => {
    expect(normalizeCategoryInput("  Arts  &  Café ")).toEqual({ name: "Arts & Café", slug: "arts-and-cafe" });
    expect(normalizeCategoryInput("Children’s Activities").name).toBe("Children's Activities");
  });
  it("recognizes reserved legacy tags without depending on a hardcoded category list", () => {
    expect(fromEventCategoryTagName("Event Category: Robotics Workshops")).toBe("Robotics Workshops");
    expect(isEventCategoryTagName(" event category: ")).toBe(true);
    expect(isEventCategoryTagName("Robotics Workshops")).toBe(false);
    expect(fromEventCategoryTagName(null)).toBeNull();
  });
});
