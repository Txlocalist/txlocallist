// Initial seed values only. Live forms load EventCategory rows from the database.
export const EVENT_CATEGORY_LIMIT = 3;
export const EVENT_TAG_LIMIT = 10;

export const EVENT_CATEGORIES = [
  "Live Music",
  "Family Friendly",
  "Food & Drink",
  "Networking",
  "Arts & Culture",
  "Outdoor",
  "Wellness",
  "Community",
  "Farmers Market",
  "Craft Fair",
  "Vaccination Clinics",
  "Festival",
  "Fundraiser",
  "Cultural Event",
  "Yard Sale",
  "Other",
];

const EVENT_CATEGORY_TAG_PREFIX = "Event Category: ";

export function toEventCategoryTagName(category) {
  return `${EVENT_CATEGORY_TAG_PREFIX}${category}`;
}

export function fromEventCategoryTagName(tagName) {
  if (!isEventCategoryTagName(tagName)) {
    return null;
  }

  return tagName.slice(tagName.indexOf(":") + 1).trim() || null;
}

export function isEventCategoryTagName(tagName) {
  return typeof tagName === "string" && /^Event Category:/i.test(tagName.trim());
}
