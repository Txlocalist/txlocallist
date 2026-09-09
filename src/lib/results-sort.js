export const SORT_OPTIONS = Object.freeze([
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "A to Z" },
  { value: "name-desc", label: "Z to A" },
]);

export function normalizeSort(value, fallback = "newest", extras = []) {
  return [...SORT_OPTIONS.map((option) => option.value), ...extras].includes(value) ? value : fallback;
}

export function resultOrderBy(value, { name = "name", date = "createdAt", fallback = "newest", extras = [] } = {}) {
  const sort = normalizeSort(value, fallback, extras);
  if (sort === "popular") return [{ favorites: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }];
  if (sort === "upcoming") return [{ startDate: "asc" }, { id: "asc" }];
  return [{ [sort.startsWith("name-") ? name : date]: ["oldest", "name-asc"].includes(sort) ? "asc" : "desc" }, { id: "asc" }];
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
export function sortResults(items, value, { name = (item) => item.name ?? item.title ?? "", date = (item) => item.createdAt, fallback = "newest", extras = [] } = {}) {
  const sort = normalizeSort(value, fallback, extras);
  const timestamp = (input) => {
    const time = new Date(input ?? 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  return [...items].sort((a, b) => {
    let result;
    if (sort.startsWith("name-")) result = collator.compare(name(a), name(b)) * (sort === "name-desc" ? -1 : 1);
    else if (sort === "popular") result = (b.favoritesCount ?? 0) - (a.favoritesCount ?? 0);
    else if (sort === "upcoming") result = timestamp(a.startDate) - timestamp(b.startDate);
    else result = (timestamp(date(a)) - timestamp(date(b))) * (sort === "oldest" ? 1 : -1);
    return result || String(a.id ?? a.businessId).localeCompare(String(b.id ?? b.businessId));
  });
}
