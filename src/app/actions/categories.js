"use server";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CATEGORY_TYPES, normalizeCategoryInput } from "@/lib/categories";
import { revalidatePath } from "next/cache";

const fail = (error) => ({ error, fieldErrors: { name: error }, success: "" });

async function saveCategory(formData, editing) {
  const admin = await requireAdmin();
  const type = formData.get("type");
  const config = Object.hasOwn(CATEGORY_TYPES, type) ? CATEGORY_TYPES[type] : null;
  if (!config) return fail("Choose business or event categories.");
  const input = normalizeCategoryInput(formData.get("name"));
  if (input.error) return fail(input.error);
  const id = formData.get("categoryId")?.toString();
  if (editing && !id) return fail("Select a category to rename.");
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Keep case-insensitive duplicate checks and stale-form checks atomic.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`txlocalist:categories:${type}`}))`;
      const model = tx[config.model];
      const existing = editing ? await model.findUnique({ where: { id } }) : null;
      if (editing && !existing) return fail("Category not found. Refresh the page and try again.");
      if (editing && existing.name !== formData.get("expectedName")) return fail("This category changed in another request. Refresh the page and try again.");
      const duplicate = await model.findFirst({ where: {
        ...(editing ? { id: { not: id } } : {}),
        OR: [{ name: { equals: input.name, mode: "insensitive" } }, { slug: input.slug }],
      } });
      if (duplicate) return fail(`That ${config.singular} already exists.`);
      // Slugs and IDs stay stable so existing listings and category links keep working.
      const category = editing
        ? await model.update({ where: { id }, data: { name: input.name } })
        : await model.create({ data: input });
      await tx.auditLog.create({ data: {
        actorId: admin.id, action: editing ? "update" : "create", entity: config.entity, entityId: category.id,
        meta: JSON.stringify({ type, ...(existing ? { previousName: existing.name } : {}), name: category.name }),
      } });
      return { error: "", fieldErrors: {}, success: editing
        ? `${input.name} saved. Existing ${type === "business" ? "business listings" : "events"} will show the new name.`
        : `${input.name} is now available in ${type} forms.` };
    });
    if (!result.error) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error?.code === "P2002") return fail(`That ${config.singular} already exists.`);
    console.error("[categories] Could not save category:", error);
    return fail("The category could not be saved. Please try again.");
  }
}

export async function createCategoryAction(_previousState, formData) {
  return saveCategory(formData, false);
}

export async function renameCategoryAction(_previousState, formData) {
  return saveCategory(formData, true);
}
