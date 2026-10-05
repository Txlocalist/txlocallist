import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ tag: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getEventCategorySecondaryCounts, getEventTagOptions, renameEventCategoryTags, resolveEventCategories } from "@/lib/categories.server";

const categories = [
  { id: "music", name: "Live Music" },
  { id: "food", name: "Food & Drink" },
  { id: "outdoor", name: "Outdoor" },
];
const tx = {
  $queryRaw: vi.fn(),
  eventCategory: { findUnique: vi.fn(), findFirst: vi.fn() },
  tag: { findMany: vi.fn(), upsert: vi.fn() },
  event: { update: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.eventCategory.findUnique.mockImplementation(async ({ where }) => categories.find((category) => category.id === where.id));
  tx.eventCategory.findFirst.mockImplementation(async ({ where }) => categories.find((category) => category.name.toLowerCase() === where.name.equals.toLowerCase()));
});

describe("event category selection", () => {
  it("counts secondary category events once without double-counting their primary category", async () => {
    db.tag.findMany.mockResolvedValue([
      { name: "Event Category: Live Music", events: [{ id: "a", categoryId: "food" }, { id: "b", categoryId: "music" }] },
      { name: "Event Category: live music", events: [{ id: "a", categoryId: "food" }] },
      { name: "Event Category: Outdoor", events: [{ id: "a", categoryId: "food" }] },
    ]);
    expect(await getEventCategorySecondaryCounts(categories)).toEqual(new Map([["music", 1], ["outdoor", 1]]));
  });

  it("keeps category markers out of the optional tag picker", async () => {
    db.tag.findMany.mockResolvedValue([{ id: "a", name: "Event Category: Outdoor" }, { id: "b", name: "Free Admission" }]);
    expect(await getEventTagOptions()).toEqual([{ id: "b", name: "Free Admission" }]);
  });

  it("keeps the primary category relation and persists two additional categories as reserved markers", async () => {
    expect(await resolveEventCategories(tx, { categoryIds: ["music", "food", "outdoor"] })).toEqual({
      categoryId: "music", categoryTagNames: ["Event Category: Food & Drink", "Event Category: Outdoor"],
    });
  });

  it("rejects four categories instead of silently dropping a selection", async () => {
    await expect(resolveEventCategories(tx, { categoryIds: ["music", "food", "outdoor", "other"] })).rejects.toMatchObject({
      code: "EVENT_CATEGORY_UNAVAILABLE", message: "Choose no more than 3 event categories.",
    });
    expect(tx.eventCategory.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid and empty choices and deduplicates repeated IDs", async () => {
    await expect(resolveEventCategories(tx, { categoryIds: ["music", "deleted"] })).rejects.toMatchObject({ code: "EVENT_CATEGORY_UNAVAILABLE" });
    await expect(resolveEventCategories(tx, { categoryIds: [], category: "" })).rejects.toMatchObject({ code: "EVENT_CATEGORY_UNAVAILABLE" });
    expect(await resolveEventCategories(tx, { categoryIds: ["music", "music", "food"] })).toEqual({
      categoryId: "music", categoryTagNames: ["Event Category: Food & Drink"],
    });
  });

  it("accepts older open forms with a single stable ID or category name", async () => {
    expect(await resolveEventCategories(tx, { categoryIds: [], categoryId: "music" })).toEqual({ categoryId: "music", categoryTagNames: [] });
    expect(await resolveEventCategories(tx, { category: "live music" })).toEqual({ categoryId: "music", categoryTagNames: [] });
  });

  it("moves secondary category links to the renamed marker without replacing unrelated tags", async () => {
    tx.tag.findMany.mockResolvedValue([{ id: "old-marker", events: [{ id: "event-1" }, { id: "event-2" }] }]);
    tx.tag.upsert.mockResolvedValue({ id: "existing-target-marker" });
    await renameEventCategoryTags(tx, "Outdoor", "Outdoor Adventures");
    expect(tx.tag.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: "Event Category: Outdoor Adventures" } }));
    expect(tx.event.update).toHaveBeenCalledTimes(2);
    expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { tags: {
      disconnect: { id: "old-marker" }, connect: { id: "existing-target-marker" },
    } } });
  });
});
