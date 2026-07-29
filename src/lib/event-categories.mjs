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

const EVENT_CATEGORY_SET = new Set(EVENT_CATEGORIES);
const EVENT_CATEGORY_TAG_PREFIX = "Event Category: ";

export function isEventCategory(value) {
  return EVENT_CATEGORY_SET.has(value);
}

export function toEventCategoryTagName(category) {
  return `${EVENT_CATEGORY_TAG_PREFIX}${category}`;
}

export function fromEventCategoryTagName(tagName) {
  if (typeof tagName !== "string" || !tagName.startsWith(EVENT_CATEGORY_TAG_PREFIX)) {
    return null;
  }

  const category = tagName.slice(EVENT_CATEGORY_TAG_PREFIX.length);
  return isEventCategory(category) ? category : null;
}

export function isEventCategoryTagName(tagName) {
  return fromEventCategoryTagName(tagName) !== null;
}
