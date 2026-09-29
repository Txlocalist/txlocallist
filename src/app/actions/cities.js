"use server";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isUncategorizedCity, normalizeCityInput, UNCATEGORIZED_CITY } from "@/lib/cities";
import { eventsInCity, lockCity } from "@/lib/cities.server";
import { revalidatePath } from "next/cache";

const fail = (message) => ({ error: message, fieldErrors: { name: message }, success: "" });

function isCityWriteConflict(error) {
  // Prisma 7 adapters surface a conflict in a raw row-lock query as P2010.
  const cause = error?.meta?.driverAdapterError?.cause;
  return error?.code === "P2034" || (error?.code === "P2010" && (
    cause?.kind === "TransactionWriteConflict" || ["40001", "40P01"].includes(error.meta?.code ?? cause?.originalCode)
  ));
}

async function cityTransaction(work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Serialize taxonomy changes, including case-insensitive duplicate checks.
        // ReadCommitted sees events that finish while the city row lock is waiting.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('txlocalist:city-management'))`;
        return work(tx);
      }, { isolationLevel: "ReadCommitted" });
    } catch (error) {
      if (!isCityWriteConflict(error) || attempt >= 2) throw error;
    }
  }
}

function cityError(error, verb) {
  if (error?.code === "P2002") return fail("That city already exists.");
  if (isCityWriteConflict(error) || error?.code === "P2025") return fail("This city changed in another request. Refresh the page and try again.");
  console.error(`[cities] City could not be ${verb}:`, error);
  return fail(`The city could not be ${verb}. Please try again.`);
}

async function duplicateCity(tx, input, id) {
  return tx.city.findFirst({ where: {
    ...(id ? { id: { not: id } } : {}),
    OR: [{ name: { equals: input.name, mode: "insensitive" } }, { slug: input.slug }],
  } });
}

function checkEditableCity(city, formData) {
  if (!city) return fail("City not found. Refresh the page and try again.");
  if (isUncategorizedCity(city)) return fail("Uncategorized is a protected fallback city and cannot be renamed or deleted.");
  if (city.name !== formData.get("expectedName")) return fail("This city changed in another request. Refresh the page and try again.");
  return null;
}

export async function createCityAction(_previousState, formData) {
  const admin = await requireAdmin();
  const input = normalizeCityInput(formData.get("name"));
  if (input.error) return fail(input.error);
  try {
    const result = await cityTransaction(async (tx) => {
      if (await duplicateCity(tx, input)) return fail("That city already exists. Choose it from the city list.");
      const city = await tx.city.create({ data: input });
      await tx.auditLog.create({ data: { actorId: admin.id, action: "create", entity: "City", entityId: city.id } });
    });
    if (result?.error) return result;
  } catch (error) {
    return cityError(error, "added");
  }
  revalidatePath("/", "layout");
  return { error: "", fieldErrors: {}, success: `${input.name} is now available in business and event forms and Explore.` };
}

export async function renameCityAction(_previousState, formData) {
  const admin = await requireAdmin();
  const input = normalizeCityInput(formData.get("name"));
  if (input.error) return fail(input.error);
  const id = formData.get("cityId")?.toString();
  if (!id) return fail("Select a city to rename.");
  try {
    const result = await cityTransaction(async (tx) => {
      const city = await lockCity(tx, id, true);
      const error = checkEditableCity(city, formData);
      if (error) return error;
      if (await duplicateCity(tx, input, id)) return fail("That city already exists. Choose a different name.");
      // Keep the id and slug stable so businesses and existing city URLs still work.
      await tx.city.update({ where: { id }, data: { name: input.name } });
      const events = await tx.event.updateMany({ where: eventsInCity(city.name), data: { city: input.name } });
      await tx.auditLog.create({ data: {
        actorId: admin.id, action: "update", entity: "City", entityId: id,
        meta: JSON.stringify({ previousName: city.name, name: input.name, updatedEvents: events.count }),
      } });
    });
    if (result?.error) return result;
  } catch (error) {
    return cityError(error, "renamed");
  }
  revalidatePath("/", "layout");
  return { error: "", fieldErrors: {}, success: `City renamed to ${input.name}. Business and event locations are up to date.` };
}

export async function deleteCityAction(_previousState, formData) {
  const admin = await requireAdmin();
  const id = formData.get("cityId")?.toString();
  if (!id || formData.get("confirmed") !== "yes") return fail("Confirm the city deletion first.");
  let result;
  try {
    result = await cityTransaction(async (tx) => {
      const city = await lockCity(tx, id, true);
      const error = checkEditableCity(city, formData);
      if (error) return error;
      const fallback = await tx.city.upsert({
        where: { slug: UNCATEGORIZED_CITY.slug }, update: {}, create: UNCATEGORIZED_CITY,
      });
      const businesses = await tx.business.updateMany({ where: { cityId: id }, data: { cityId: fallback.id } });
      const events = await tx.event.updateMany({ where: eventsInCity(city.name), data: { city: fallback.name } });
      await tx.city.delete({ where: { id } });
      await tx.auditLog.create({ data: {
        actorId: admin.id, action: "delete", entity: "City", entityId: id,
        meta: JSON.stringify({ name: city.name, fallbackCityId: fallback.id, movedBusinesses: businesses.count, movedEvents: events.count }),
      } });
      return { name: city.name, businesses: businesses.count, events: events.count };
    });
    if (result?.error) return result;
  } catch (error) {
    return cityError(error, "deleted");
  }
  revalidatePath("/", "layout");
  return { error: "", fieldErrors: {}, success: `${result.name} deleted. ${result.businesses} businesses and ${result.events} events moved to Uncategorized.` };
}
