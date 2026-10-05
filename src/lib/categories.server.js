import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { EVENT_CATEGORY_LIMIT, isEventCategoryTagName, toEventCategoryTagName } from "@/lib/event-categories.mjs";

export function getEventCategoryOptions() {
  return prisma.eventCategory.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
}

export async function getEventTagOptions() {
  const tags = await prisma.tag.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return tags.filter((tag) => !isEventCategoryTagName(tag.name));
}

export async function getEventCategorySecondaryCounts(categories) {
  if (!categories.length) return new Map();
  const categoryByName = new Map(categories.map((category) => [toEventCategoryTagName(category.name).toLowerCase(), category.id]));
  const tags = await prisma.tag.findMany({
    where: { name: { in: categories.map((category) => toEventCategoryTagName(category.name)), mode: "insensitive" } },
    select: { name: true, events: { select: { id: true, categoryId: true } } },
  });
  const eventIds = new Map();
  for (const tag of tags) {
    const categoryId = categoryByName.get(tag.name.toLowerCase());
    if (!categoryId) continue;
    if (!eventIds.has(categoryId)) eventIds.set(categoryId, new Set());
    for (const event of tag.events) {
      if (event.categoryId !== categoryId) eventIds.get(categoryId).add(event.id);
    }
  }
  return new Map([...eventIds].map(([categoryId, ids]) => [categoryId, ids.size]));
}

export async function resolveEventCategories(tx, values) {
  const ids = [...new Set(values.categoryIds ?? (values.categoryId ? [values.categoryId] : []))];
  if (ids.length > EVENT_CATEGORY_LIMIT) {
    throw Object.assign(new Error(`Choose no more than ${EVENT_CATEGORY_LIMIT} event categories.`), { code: "EVENT_CATEGORY_UNAVAILABLE" });
  }
  // Category names used by marker tags must stay consistent with admin renames.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${"txlocalist:categories:event"}))`;
  const categoryIds = ids.length ? ids : [await resolveEventCategory(tx, values)];
  const categories = await Promise.all(categoryIds.map((id) => tx.eventCategory.findUnique({ where: { id } })));
  if (categories.some((category) => !category)) {
    throw Object.assign(new Error("Select an available event category for each selection. Refresh the page if the options have changed."), { code: "EVENT_CATEGORY_UNAVAILABLE" });
  }
  // Retain the primary relation for existing clients; additional categories use
  // the reserved category-tag convention already supported by older events.
  return {
    categoryId: categories[0].id,
    categoryTagNames: categories.slice(1).map((category) => toEventCategoryTagName(category.name)),
  };
}

export async function renameEventCategoryTags(tx, previousName, name) {
  const previousTags = await tx.tag.findMany({
    where: { name: { equals: toEventCategoryTagName(previousName), mode: "insensitive" } },
    select: { id: true, events: { select: { id: true } } },
  });
  if (!previousTags.length) return;
  const target = await tx.tag.upsert({
    where: { name: toEventCategoryTagName(name) },
    create: { name: toEventCategoryTagName(name), slug: `event-category-${randomUUID()}` },
    update: {},
  });
  for (const tag of previousTags) {
    if (tag.id === target.id) continue;
    for (const event of tag.events) {
      await tx.event.update({ where: { id: event.id }, data: { tags: { disconnect: { id: tag.id }, connect: { id: target.id } } } });
    }
  }
}

export async function resolveEventCategory(tx, values) {
  // Accept names from old open forms, while current forms submit a stable id.
  const category = values.categoryId
    ? await tx.eventCategory.findUnique({ where: { id: values.categoryId } })
    : await tx.eventCategory.findFirst({ where: { name: { equals: values.category, mode: "insensitive" } } });
  if (!category) {
    throw Object.assign(new Error("Select an available event category. Refresh the page if the options have changed."), { code: "EVENT_CATEGORY_UNAVAILABLE" });
  }
  return category.id;
}
