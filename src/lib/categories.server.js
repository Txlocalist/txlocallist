import { prisma } from "@/lib/prisma";

export function getEventCategoryOptions() {
  return prisma.eventCategory.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
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
