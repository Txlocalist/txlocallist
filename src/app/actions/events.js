"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

function getTextValue(formData, key) {
  return formData.get(key)?.toString().trim() ?? "";
}

function slugifyTag(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Create a new event.
 */
export async function createEventAction(prevState, formData) {
  const user = await requireUser();
  const billingState = await getOwnerBillingState(user.id).catch(() => null);

  if (user.role !== "ADMIN" && !billingState?.hasPaidAccess) {
    return { error: "Upgrade to the paid plan before posting events.", fieldErrors: {} };
  }

  const title        = getTextValue(formData, "title");
  const description  = getTextValue(formData, "description");
  const imageUrl     = getTextValue(formData, "imageUrl");
  const addressName  = getTextValue(formData, "addressName");
  const address      = getTextValue(formData, "address");
  const zipCode      = getTextValue(formData, "zipCode");
  const city         = getTextValue(formData, "city");
  const state        = getTextValue(formData, "state") || "TX";
  const country      = getTextValue(formData, "country") || "US";
  const businessId   = getTextValue(formData, "businessId") || null;
  const startDateRaw = getTextValue(formData, "startDate");
  const endDateRaw   = getTextValue(formData, "endDate");
  const tagsRaw      = getTextValue(formData, "tags");

  // Validation
  const fieldErrors = {};
  if (!title || title.length < 3)       fieldErrors.title       = "Title must be at least 3 characters.";
  if (!description || description.length < 20) fieldErrors.description = "Description must be at least 20 characters.";
  if (!address)     fieldErrors.address     = "Street address is required.";
  if (!city)        fieldErrors.city        = "City is required.";
  if (!zipCode)     fieldErrors.zipCode     = "ZIP code is required.";
  if (!businessId && user.role !== "ADMIN") fieldErrors.businessId = "Choose one of your businesses.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the errors below.", fieldErrors };
  }

  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    });

    if (!business || (business.ownerId !== user.id && user.role !== "ADMIN")) {
      return {
        error: "Choose a valid business before publishing the event.",
        fieldErrors: { businessId: "This business is not available for your account." },
      };
    }
  }

  // Parse tags (comma-separated names) — optional
  const tagNames = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const tagConnects = [];
  for (const name of tagNames) {
    const slug = slugifyTag(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    tagConnects.push({ id: tag.id });
  }

  try {
    await prisma.event.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || "",
        addressName: addressName || address,
        address,
        zipCode,
        city,
        state,
        country,
        creatorId: user.id,
        businessId: businessId || null,
        startDate: startDateRaw ? new Date(startDateRaw) : null,
        endDate:   endDateRaw   ? new Date(endDateRaw)   : null,
        status: "PENDING",
        ...(tagConnects.length > 0 ? { tags: { connect: tagConnects } } : {}),
      },
    });
  } catch (err) {
    console.error("[createEventAction]", err);
    return { error: "Failed to create event. Please try again." };
  }

  revalidatePath("/events");
  revalidatePath("/dashboard/events");
  redirect("/dashboard/events?created=1");
}

/**
 * Delete an event (owner or admin only).
 */
export async function deleteEventAction(formData) {
  const user = await requireUser();
  const eventId = formData.get("eventId")?.toString();
  if (!eventId) return;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;
  if (event.creatorId !== user.id && user.role !== "ADMIN") return;

  await prisma.event.delete({ where: { id: eventId } });

  revalidatePath("/events");
  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}
