import { prisma } from "@/lib/prisma";
import { isUncategorizedCity, UNCATEGORIZED_CITY } from "@/lib/cities";

export function getSelectableCities(currentCityId = null) {
  return prisma.city.findMany({
    where: { OR: [{ slug: { not: UNCATEGORIZED_CITY.slug } }, ...(currentCityId ? [{ id: currentCityId }] : [])] },
    orderBy: { name: "asc" },
  });
}

// Events predate the managed city list and store their location as text.
// Only Texas/US locations belong to this directory's city taxonomy.
export function eventsInCity(name) {
  return {
    city: { equals: name, mode: "insensitive" },
    state: { in: ["TX", "Texas"], mode: "insensitive" },
    country: { in: ["US", "USA", "United States"], mode: "insensitive" },
  };
}

export async function lockCity(tx, id, exclusive = false) {
  // Shared locks keep a selected name current until the event is saved;
  // admin edits/deletions take the exclusive lock before moving any listings.
  const rows = exclusive
    ? await tx.$queryRaw`SELECT * FROM "City" WHERE "id" = ${id} FOR UPDATE`
    : await tx.$queryRaw`SELECT * FROM "City" WHERE "id" = ${id} FOR SHARE`;
  return rows[0] ?? null;
}

export async function resolveEventCity(tx, values, existingEvent = null) {
  let cityId = values.cityId;
  if (!cityId) {
    // Support older open forms and existing events with a free-text location.
    const city = await tx.city.findFirst({ where: eventsCityLookup(values) });
    cityId = city?.id;
    if (!cityId && existingEvent && values.city === existingEvent.city && values.state === existingEvent.state && values.country === existingEvent.country) {
      return { city: existingEvent.city, state: existingEvent.state, country: existingEvent.country };
    }
  }
  const city = cityId ? await lockCity(tx, cityId) : null;
  if (!city || (isUncategorizedCity(city) && existingEvent?.city !== city.name)) {
    throw Object.assign(new Error("This city is no longer available. Refresh the page and select a city."), { code: "CITY_UNAVAILABLE" });
  }
  return { city: city.name, state: "TX", country: "US" };
}

function eventsCityLookup(values) {
  const isTexas = ["tx", "texas"].includes(values.state.toLowerCase());
  const isUS = ["us", "usa", "united states"].includes(values.country.toLowerCase());
  return { name: { equals: values.city, mode: "insensitive" }, ...(!isTexas || !isUS ? { id: "" } : {}) };
}
