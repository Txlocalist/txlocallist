import { prisma } from "@/lib/prisma";

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function slugifyCategoryLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferEventType(event) {
  const text = [
    event.title,
    event.description,
    ...(event.tags || []).map((tag) => tag.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("karaoke") || text.includes("karokee") || text.includes("music") || text.includes("concert") || text.includes("band") || text.includes("open mic")) return "Live Music";
  if (text.includes("market") || text.includes("yard sale") || text.includes("vendor") || text.includes("fair") || text.includes("makers")) return "Markets";
  if (text.includes("food") || text.includes("drink") || text.includes("pizza") || text.includes("beer") || text.includes("taco")) return "Food & Drink";
  if (text.includes("night") || text.includes("dj") || text.includes("dance")) return "Nightlife";
  if (text.includes("family") || text.includes("kids") || text.includes("park") || text.includes("responders")) return "Family";
  if (text.includes("outdoor") || text.includes("patio") || text.includes("trail")) return "Outdoor";

  return event.tags?.[0]?.name || "Community";
}

function formatCityLabel(city, state) {
  const cityValue = String(city || "").trim();
  const stateValue = String(state || "").trim().toUpperCase();
  if (!cityValue) return "Texas";
  return stateValue ? `${cityValue}, ${stateValue}` : cityValue;
}

function parseDateKey(dateKey) {
  if (!dateKey || dateKey === "undated") return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function keyFromLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodayKey() {
  return formatEventDateKey(new Date());
}

function getDateWindowKeys(dateFilter) {
  const value = String(dateFilter || "").trim().toLowerCase();
  if (!value || value === "all" || value === "all-dates") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Set([value]);
  }

  const today = parseDateKey(getTodayKey());
  if (!today) return null;

  if (value === "today" || value === "tonight") {
    return new Set([keyFromLocalDate(today)]);
  }

  if (value === "tomorrow") {
    return new Set([keyFromLocalDate(addDays(today, 1))]);
  }

  if (value === "next-7-days" || value === "next 7 days") {
    return new Set(
      Array.from({ length: 8 }, (_, index) => keyFromLocalDate(addDays(today, index)))
    );
  }

  if (value === "this-weekend" || value === "this weekend") {
    const day = today.getDay();
    const fridayOffset = day <= 5 ? 5 - day : -1;
    const friday = addDays(today, fridayOffset);
    return new Set([0, 1, 2].map((offset) => keyFromLocalDate(addDays(friday, offset))));
  }

  return null;
}

export function formatEventDateKey(startDate) {
  if (!startDate) return "undated";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(startDate));

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function formatEventTime(startDate) {
  if (!startDate) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startDate));
}

export function formatLongEventDate(startDate) {
  if (!startDate) return "Date coming soon";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(startDate));
}

export function formatShortDateLabel(dateKey) {
  if (!dateKey || dateKey === "undated") return "Date TBD";
  const parsed = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function normalizeEvent(event) {
  const type = inferEventType(event);
  const tags = unique([type, ...(event.tags || []).map((tag) => tag.name)]).slice(0, 6);
  const categoryTags = unique((event.tags || []).map((tag) => tag.name)).map((name) => ({
    name,
    slug: slugifyCategoryLabel(name),
  }));

  return {
    id: event.id,
    slug: event.id,
    title: event.title || "Untitled Event",
    description: event.description || "Local event details coming soon.",
    imageUrl: event.imageUrl || "",
    addressName: event.addressName || "",
    address: event.address || "",
    city: event.city || "",
    state: event.state || "",
    cityLabel: formatCityLabel(event.city, event.state),
    venue: event.addressName || event.address || event.business?.name || "Local Venue",
    business: event.business
      ? {
          name: event.business.name,
          slug: event.business.slug,
        }
      : null,
    categoryTags,
    tags,
    type,
    startDate: event.startDate ? event.startDate.toISOString() : null,
    endDate: event.endDate ? event.endDate.toISOString() : null,
    dateKey: formatEventDateKey(event.startDate),
    timeLabel: formatEventTime(event.startDate),
  };
}

export async function getPublishedEvents() {
  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      addressName: true,
      address: true,
      city: true,
      state: true,
      startDate: true,
      endDate: true,
      tags: { select: { name: true, slug: true } },
      business: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return events.map(normalizeEvent);
}

export function getEventCities(events) {
  return unique(events.map((event) => event.cityLabel)).sort((a, b) => a.localeCompare(b));
}

export function getEventCategories(events, liveCategoryNames = []) {
  const fromDashboard = unique(liveCategoryNames);
  if (fromDashboard.length) {
    return fromDashboard.sort((a, b) => a.localeCompare(b));
  }

  return unique(
    events.flatMap((event) => {
      const names = (event.categoryTags || []).map((category) => category.name).filter(Boolean);
      return names.length ? names : [event.type];
    })
  ).sort((a, b) => a.localeCompare(b));
}

export function filterEvents(events, { query = "", location = "", category = "", date = "" } = {}) {
  const queryValue = String(query || "").trim().toLowerCase();
  const locationValue = String(location || "").trim().toLowerCase();
  const categoryValue = String(category || "").trim().toLowerCase();
  const dateKeys = getDateWindowKeys(date);

  return events.filter((event) => {
    if (queryValue) {
      const haystack = [
        event.title,
        event.description,
        event.venue,
        event.cityLabel,
        ...(event.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(queryValue)) {
        return false;
      }
    }

    if (locationValue) {
      const locationHaystack = [event.cityLabel, event.city, event.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!locationHaystack.includes(locationValue)) {
        return false;
      }
    }

    if (categoryValue) {
      const categoryHaystack = [event.type, ...(event.tags || [])]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      if (!categoryHaystack.includes(categoryValue)) {
        return false;
      }
    }

    if (dateKeys && !dateKeys.has(event.dateKey)) {
      return false;
    }

    return true;
  });
}

export function groupEventsByDate(events) {
  const groups = new Map();

  for (const event of events) {
    const key = event.dateKey || "undated";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(event);
  }

  return Array.from(groups.entries()).map(([dateKey, items]) => ({
    dateKey,
    label: formatShortDateLabel(dateKey),
    items,
  }));
}

export async function getEventsPageData(filters = {}) {
  const [events, liveCategories] = await Promise.all([
    getPublishedEvents(),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);
  const filteredEvents = filterEvents(events, filters);

  return {
    allEvents: events,
    filteredEvents,
    groupedEvents: groupEventsByDate(filteredEvents),
    cities: getEventCities(events),
    categories: getEventCategories(
      events,
      liveCategories.map((category) => category.name)
    ),
  };
}

export async function getEventById(id) {
  const event = await prisma.event.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      addressName: true,
      address: true,
      city: true,
      state: true,
      startDate: true,
      endDate: true,
      tags: { select: { name: true, slug: true } },
      business: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  return event ? normalizeEvent(event) : null;
}
