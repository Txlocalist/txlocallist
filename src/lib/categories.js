export const CATEGORY_TYPES = {
  business: { title: "Business Categories", singular: "business category", model: "category", relation: "businessCategories", entity: "Category" },
  event: { title: "Event Categories", singular: "event category", model: "eventCategory", relation: "events", entity: "EventCategory" },
};

export function normalizeCategoryInput(value) {
  const name = typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ").replace(/’/g, "'") : "";
  const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (name.length < 2 || name.length > 100 || !slug || !/^[\p{L}\p{M}\p{N} &.'()/-]+$/u.test(name)) {
    return { error: "Enter a category name between 2 and 100 characters using letters, numbers, spaces, or common punctuation." };
  }
  return { name, slug };
}
