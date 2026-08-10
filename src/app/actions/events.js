"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";
import {
  isEventCategory,
  isEventCategoryTagName,
  toEventCategoryTagName,
} from "@/lib/event-categories.mjs";
import {
  EventDateValidationError,
  validateOrganizerEventDateRange,
} from "@/lib/event-dates.server";
import {
  cancelEventPosting,
  createEventCheckoutSession,
  expireOpenEventCheckoutSessions,
} from "@/lib/event-payments";
import { isEventPostingEnabled } from "@/lib/pricing";
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

function isSafeEventUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function revalidateEventPaths(eventId = null) {
  revalidatePath("/events");
  revalidatePath("/events/results");
  revalidatePath("/dashboard/events");
  revalidatePath("/admin/events");
  revalidatePath("/admin/posts");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

async function getValidatedEventInput(formData, user, existingEvent = null) {
  const values = {
    title: getTextValue(formData, "title"),
    category: getTextValue(formData, "category"),
    description: getTextValue(formData, "description"),
    imageUrl: getTextValue(formData, "imageUrl"),
    addressName: getTextValue(formData, "addressName"),
    address: getTextValue(formData, "address"),
    zipCode: getTextValue(formData, "zipCode"),
    city: getTextValue(formData, "city"),
    state: getTextValue(formData, "state") || "TX",
    country: getTextValue(formData, "country") || "US",
    businessId: getTextValue(formData, "businessId") || null,
    startDateRaw: getTextValue(formData, "startDate"),
    endDateRaw: getTextValue(formData, "endDate"),
    timezone: getTextValue(formData, "timezone"),
    eventUrl: getTextValue(formData, "eventUrl"),
    tagsRaw: getTextValue(formData, "tags"),
  };
  const fieldErrors = {};

  if (!isEventCategory(values.category)) fieldErrors.category = "Choose a valid event category.";
  if (values.title.length < 3) fieldErrors.title = "Title must be at least 3 characters.";
  if (values.title.length > 120) fieldErrors.title = "Title must be 120 characters or fewer.";
  if (values.description.length < 20) fieldErrors.description = "Description must be at least 20 characters.";
  if (values.description.length > 300) fieldErrors.description = "Description must be 300 characters or fewer.";
  if (!values.address) fieldErrors.address = "Street address is required.";
  if (!values.city) fieldErrors.city = "City is required.";
  if (!values.zipCode) fieldErrors.zipCode = "ZIP code is required.";
  if (!isSafeEventUrl(values.eventUrl) || values.eventUrl.length > 2048) {
    fieldErrors.eventUrl = "Enter a valid http or https event link.";
  }

  let schedule = null;
  try {
    schedule = validateOrganizerEventDateRange({
      startDate: values.startDateRaw,
      endDate: values.endDateRaw,
      timeZone: values.timezone,
    });
  } catch (error) {
    const message = error instanceof EventDateValidationError
      ? error.message
      : "Enter a valid event date range.";
    fieldErrors.startDate = message;
    fieldErrors.endDate = message;
  }

  let business = null;
  if (values.businessId) {
    business = await prisma.business.findUnique({
      where: { id: values.businessId },
      select: { id: true, ownerId: true, status: true },
    });

    if (
      !business ||
      (user.role !== "ADMIN" && business.ownerId !== user.id) ||
      business.status !== "ACTIVE"
    ) {
      fieldErrors.businessId = "Choose an active business owned by this account.";
    }
  }

  let imageUpload = null;
  if (values.imageUrl && values.imageUrl !== existingEvent?.imageUrl) {
    imageUpload = await prisma.eventImageUpload.findUnique({
      where: { url: values.imageUrl },
      select: { id: true, userId: true, eventId: true },
    });

    if (
      !imageUpload ||
      imageUpload.userId !== user.id ||
      (imageUpload.eventId && imageUpload.eventId !== existingEvent?.id)
    ) {
      fieldErrors.imageUrl = "Upload the event image from this form.";
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !schedule) {
    return { error: "Please fix the errors below.", fieldErrors };
  }

  const optionalTagNames = values.tagsRaw
    ? values.tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag && !isEventCategoryTagName(tag))
        .slice(0, 10)
    : [];
  const tagNames = [toEventCategoryTagName(values.category), ...optionalTagNames]
    .filter((name, index, names) => {
      const normalized = name.toLowerCase();
      return names.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
    });

  return {
    values,
    schedule,
    business,
    imageUpload,
    tagNames,
    fieldErrors: {},
  };
}

async function upsertEventTags(tx, tagNames) {
  const tagConnects = [];

  for (const name of tagNames) {
    const slug = slugifyTag(name);
    const tag = await tx.tag.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    tagConnects.push({ id: tag.id });
  }

  return tagConnects;
}

export async function createEventAction(prevState, formData) {
  const user = await requireUser();
  const input = await getValidatedEventInput(formData, user);
  if (input.error) return input;

  const billingState = user.role === "ADMIN"
    ? null
    : await getOwnerBillingState(user.id).catch(() => null);
  const usesMembership = Boolean(
    user.role !== "ADMIN" &&
    billingState?.hasPaidAccess &&
    input.business?.ownerId === user.id,
  );
  const postingMethod = user.role === "ADMIN"
    ? "ADMIN"
    : usesMembership
      ? "SUBSCRIPTION"
      : "ONE_TIME";

  if (postingMethod === "ONE_TIME" && !isEventPostingEnabled()) {
    return {
      error: "One-time event posting is not available yet. Please try again later.",
      fieldErrors: {},
    };
  }

  let event;
  try {
    event = await prisma.$transaction(async (tx) => {
      const tagConnects = await upsertEventTags(tx, input.tagNames);
      const created = await tx.event.create({
        data: {
          title: input.values.title,
          description: input.values.description,
          imageUrl: input.values.imageUrl,
          addressName: input.values.addressName || input.values.address,
          address: input.values.address,
          zipCode: input.values.zipCode,
          city: input.values.city,
          state: input.values.state,
          country: input.values.country,
          creatorId: user.id,
          businessId: input.business?.id ?? null,
          startDate: input.schedule.startDate,
          endDate: input.schedule.endDate,
          timezone: input.schedule.timezone,
          eventUrl: input.values.eventUrl || null,
          postingMethod,
          status: postingMethod === "ONE_TIME" ? "DRAFT" : "PENDING",
          ...(tagConnects.length > 0 ? { tags: { connect: tagConnects } } : {}),
        },
      });

      if (input.imageUpload) {
        await tx.eventImageUpload.update({
          where: { id: input.imageUpload.id },
          data: { eventId: created.id, claimedAt: new Date() },
        });
      }

      return created;
    });
  } catch (error) {
    console.error("[events] event creation failed:", error);
    return { error: "Failed to create the event. Please try again.", fieldErrors: {} };
  }

  revalidateEventPaths(event.id);

  if (postingMethod !== "ONE_TIME") {
    redirect("/dashboard/events?created=1");
  }

  try {
    const session = await createEventCheckoutSession({ eventId: event.id, userId: user.id });
    if (!session.url) throw new Error("Stripe Checkout did not return a redirect URL.");
    redirect(session.url);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[events] one-time Checkout failed:", error);
    return {
      error: "Your event draft was saved, but Checkout could not start. Retry payment from My Events.",
      fieldErrors: {},
      eventId: event.id,
      retryPath: "/dashboard/events",
    };
  }
}

export async function retryEventCheckoutAction(formData) {
  const user = await requireUser();
  const eventId = getTextValue(formData, "eventId");
  if (!eventId) redirect("/dashboard/events?payment=invalid");

  try {
    const session = await createEventCheckoutSession({ eventId, userId: user.id });
    if (!session.url) throw new Error("Stripe Checkout did not return a redirect URL.");
    redirect(session.url);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[events] retry Checkout failed:", error);
    redirect("/dashboard/events?payment=unavailable");
  }
}

export async function updateEventAction(prevState, formData) {
  const user = await requireUser();
  const eventId = getTextValue(formData, "eventId");
  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : null;

  if (!event || (event.creatorId !== user.id && user.role !== "ADMIN")) {
    return { error: "Event not found.", fieldErrors: {} };
  }

  if (["CANCELLED", "DENIED"].includes(event.status) || (event.endDate && event.endDate <= new Date())) {
    return {
      error: "Ended, canceled, or denied events cannot be reused. Create a new event post instead.",
      fieldErrors: {},
    };
  }

  const input = await getValidatedEventInput(formData, user, event);
  if (input.error) return input;

  if (event.postingMethod === "SUBSCRIPTION" && user.role !== "ADMIN") {
    const billingState = await getOwnerBillingState(user.id).catch(() => null);
    if (
      !billingState?.hasPaidAccess ||
      !input.business ||
      input.business.ownerId !== user.id
    ) {
      return {
        error: "An active membership and linked active business are required to edit this event.",
        fieldErrors: { businessId: "Choose an active business covered by your membership." },
      };
    }
  }

  if (event.postingMethod === "ONE_TIME") {
    const paidPayment = await prisma.eventPayment.findFirst({
      where: { eventId: event.id, status: "PAID" },
      orderBy: { paidAt: "asc" },
      select: { eventStartDate: true, eventEndDate: true },
    });
    const purchasedStart = paidPayment?.eventStartDate ?? event.startDate;
    const purchasedEnd = paidPayment?.eventEndDate ?? event.endDate;

    if (
      paidPayment &&
      purchasedStart &&
      purchasedEnd &&
      (
        input.schedule.startDate < purchasedStart ||
        input.schedule.endDate > purchasedEnd
      )
    ) {
      return {
        error: "A paid event can only be corrected within its original date range. Create a new post to move or extend it.",
        fieldErrors: {
          startDate: "Keep the start within the originally purchased event range.",
          endDate: "Keep the end within the originally purchased event range.",
        },
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const tagConnects = await upsertEventTags(tx, input.tagNames);
      const updated = await tx.event.updateMany({
        where: {
          id: event.id,
          status: event.status,
          updatedAt: event.updatedAt,
        },
        data: {
          title: input.values.title,
          description: input.values.description,
          imageUrl: input.values.imageUrl,
          addressName: input.values.addressName || input.values.address,
          address: input.values.address,
          zipCode: input.values.zipCode,
          city: input.values.city,
          state: input.values.state,
          country: input.values.country,
          businessId: input.business?.id ?? null,
          startDate: input.schedule.startDate,
          endDate: input.schedule.endDate,
          timezone: input.schedule.timezone,
          eventUrl: input.values.eventUrl || null,
          status: event.status === "PUBLISHED" ? "PENDING" : event.status,
          publishedAt: event.publishedAt,
        },
      });

      if (updated.count !== 1) {
        throw Object.assign(
          new Error("The event changed while this edit was being saved."),
          { code: "EVENT_EDIT_CONFLICT" },
        );
      }

      await tx.event.update({
        where: { id: event.id },
        data: { tags: { set: tagConnects } },
      });

      if (input.imageUpload) {
        await tx.eventImageUpload.update({
          where: { id: input.imageUpload.id },
          data: { eventId: event.id, claimedAt: new Date() },
        });
      }
    });
  } catch (error) {
    console.error("[events] event update failed:", error);
    if (error?.code === "EVENT_EDIT_CONFLICT") {
      return {
        error: "This event changed in another request. Reload the page before editing again.",
        fieldErrors: {},
      };
    }
    return { error: "Failed to update the event. Please try again.", fieldErrors: {} };
  }

  if (event.postingMethod === "ONE_TIME" && event.status === "DRAFT") {
    await expireOpenEventCheckoutSessions(event.id);
  }

  revalidateEventPaths(event.id);
  redirect("/dashboard/events?updated=1");
}

export async function deleteEventAction(formData) {
  const user = await requireUser();
  const eventId = getTextValue(formData, "eventId");
  if (!eventId) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, creatorId: true, endDate: true },
  });
  if (!event || (event.creatorId !== user.id && user.role !== "ADMIN")) return;
  if (event.endDate && event.endDate <= new Date()) return;

  try {
    await cancelEventPosting(eventId);
  } catch (error) {
    console.error("[events] event cancellation could not finish:", error);
    redirect("/dashboard/events?cancel=blocked");
  }

  revalidateEventPaths(eventId);
  redirect("/dashboard/events?canceled=1");
}
