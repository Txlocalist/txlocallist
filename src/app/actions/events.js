"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getAccountAccess, isStaffRole } from "@/lib/account-access";
import { getEventBusinessProfileNotice } from "@/lib/event-business-profile";
import { EVENT_CATEGORY_LIMIT, EVENT_TAG_LIMIT, isEventCategoryTagName } from "@/lib/event-categories.mjs";
import { resolveEventCategories } from "@/lib/categories.server";
import {
  EventDateValidationError,
  validateOrganizerEventDateRange,
} from "@/lib/event-dates.server";
import {
  claimEventImageUpload,
  cleanupEventImageUploadsByIds,
  isEventImageUploadClaimError,
  replaceEventImageUpload,
} from "@/lib/event-image-uploads";
import {
  cancelEventPosting,
  expireOpenEventCheckoutSessions,
} from "@/lib/event-payments";
import { prisma } from "@/lib/prisma";
import { resolveEventCity } from "@/lib/cities.server";
import { isEventPast } from "@/lib/event-dates";
import { validateEventRecurrence } from "@/lib/event-recurrence";

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
  revalidatePath("/results");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  revalidatePath("/admin/events");
  revalidatePath("/admin/posts");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

async function getValidatedEventInput(formData, user, existingEvent = null) {
  const values = {
    title: getTextValue(formData, "title"),
    category: getTextValue(formData, "category"),
    categoryId: getTextValue(formData, "categoryId"),
    categoryIds: [...new Set(formData.getAll("categoryIds").map((id) => id.toString().trim()).filter(Boolean))],
    description: getTextValue(formData, "description"),
    imageUrl: getTextValue(formData, "imageUrl"),
    addressName: getTextValue(formData, "addressName"),
    address: getTextValue(formData, "address"),
    zipCode: getTextValue(formData, "zipCode"),
    city: getTextValue(formData, "city"),
    cityId: getTextValue(formData, "cityId") === "legacy" ? "" : getTextValue(formData, "cityId"),
    state: getTextValue(formData, "state") || "TX",
    country: getTextValue(formData, "country") || "US",
    businessId: getTextValue(formData, "businessId") || null,
    startDateRaw: getTextValue(formData, "startDate"),
    endDateRaw: getTextValue(formData, "endDate"),
    timezone: getTextValue(formData, "timezone"),
    eventUrl: getTextValue(formData, "eventUrl"),
    tagsRaw: getTextValue(formData, "tags"),
    recurrence: getTextValue(formData, "recurrence") || "NONE",
    recurrenceUntil: getTextValue(formData, "recurrenceUntil"),
  };
  const fieldErrors = {};

  if (!values.categoryIds.length && !values.categoryId && !values.category) fieldErrors.category = "Choose at least one event category.";
  if (values.categoryIds.length > EVENT_CATEGORY_LIMIT) fieldErrors.category = `Choose no more than ${EVENT_CATEGORY_LIMIT} event categories.`;
  if (values.title.length < 3) fieldErrors.title = "Title must be at least 3 characters.";
  if (values.title.length > 120) fieldErrors.title = "Title must be 120 characters or fewer.";
  if (values.description.length < 20) fieldErrors.description = "Description must be at least 20 characters.";
  if (values.description.length > 300) fieldErrors.description = "Description must be 300 characters or fewer.";
  if (!values.address) fieldErrors.address = "Street address is required.";
  if (!values.city && !values.cityId) fieldErrors.city = "Select a city.";
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
      allowPast: Boolean(existingEvent),
    });
  } catch (error) {
    const message = error instanceof EventDateValidationError
      ? error.message
      : "Enter a valid event date range.";
    fieldErrors.startDate = message;
    fieldErrors.endDate = message;
  }

  let recurrence = { recurrence: "NONE", recurrenceUntil: null };
  if (schedule) {
    try {
      recurrence = validateEventRecurrence({ recurrence: values.recurrence, until: values.recurrenceUntil, schedule, allowPast: Boolean(existingEvent) });
    } catch (error) {
      fieldErrors.recurrence = error.message;
    }
  }

  let business = null;
  if (values.businessId) {
    business = await prisma.business.findUnique({
      where: { id: values.businessId },
      select: { id: true, ownerId: true, status: true, deletedAt: true },
    });

    if (
      !business || business.deletedAt ||
      (user.role !== "ADMIN" && business.ownerId !== user.id) ||
      business.status !== "ACTIVE"
    ) {
      fieldErrors.businessId = "Choose an active business owned by this account.";
    }
  }

  const imageChanged = values.imageUrl !== (existingEvent?.imageUrl ?? "");
  let imageUpload = null;
  if (values.imageUrl && imageChanged) {
    imageUpload = await prisma.eventImageUpload.findUnique({
      where: { url: values.imageUrl },
      select: {
        id: true,
        userId: true,
        eventId: true,
        readyAt: true,
        cleanupStartedAt: true,
      },
    });

    if (
      !imageUpload ||
      imageUpload.userId !== user.id ||
      !imageUpload.readyAt ||
      imageUpload.cleanupStartedAt ||
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
        .slice(0, EVENT_TAG_LIMIT)
    : [];
  const tagNames = optionalTagNames
    .filter((name, index, names) => {
      const normalized = name.toLowerCase();
      return names.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
    });

  return {
    values,
    schedule,
    recurrence,
    business,
    imageUpload,
    imageChanged,
    tagNames,
    fieldErrors: {},
  };
}

async function upsertEventTags(tx, tagNames) {
  const tagConnects = [];

  for (const name of tagNames) {
    const slug = slugifyTag(name);
    const isCategory = isEventCategoryTagName(name);
    const tag = await tx.tag.upsert({
      where: isCategory ? { name } : { slug },
      create: { name, slug: isCategory ? `event-category-${randomUUID()}` : slug },
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

  let billingState = null;
  try {
    billingState = await getAccountAccess(user.id);
  } catch (error) {
    console.error("[events] billing entitlement lookup failed:", error);
    return {
      error: "We could not verify your creator access right now. Please try again before posting.",
      fieldErrors: {},
    };
  }

  if (!billingState) {
    console.error(`[events] billing entitlement lookup returned no user for ${user.id}.`);
    return {
      error: "We could not verify your creator access right now. Please try again before posting.",
      fieldErrors: {},
    };
  }
  const isStaff = isStaffRole(user.role);
  if (!isStaff && !billingState.hasMembershipAccess) {
    return {
      error: "An active business membership is required to add events to the calendar.",
      fieldErrors: {},
      businessProfilePath: "/dashboard/billing",
      businessProfileLabel: "Advertise Your Business",
    };
  }
  if (!isStaff && !input.business) {
    const ownedBusinesses = await prisma.business.findMany({
      where: { ownerId: user.id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (ownedBusinesses.some((business) => business.status === "ACTIVE")) {
      const message = "Choose your business profile under Business Profile to add this event with your account.";
      return { error: message, fieldErrors: { businessId: message } };
    }
    const notice = getEventBusinessProfileNotice(ownedBusinesses.length > 0);
    return {
      error: notice.description,
      fieldErrors: {},
      businessProfilePath: notice.href,
      businessProfileLabel: notice.label,
    };
  }
  const postingMethod = isStaff ? "ADMIN" : "SUBSCRIPTION";

  let event;
  try {
    event = await prisma.$transaction(async (tx) => {
      const location = await resolveEventCity(tx, input.values);
      const { categoryId, categoryTagNames } = await resolveEventCategories(tx, input.values);
      const tagConnects = await upsertEventTags(tx, [...categoryTagNames, ...input.tagNames]);
      const created = await tx.event.create({
        data: {
          title: input.values.title,
          description: input.values.description,
          imageUrl: input.values.imageUrl,
          addressName: input.values.addressName || input.values.address,
          address: input.values.address,
          zipCode: input.values.zipCode,
          ...location,
          categoryId,
          creatorId: user.id,
          businessId: input.business?.id ?? null,
          startDate: input.schedule.startDate,
          endDate: input.schedule.endDate,
          timezone: input.schedule.timezone,
          ...input.recurrence,
          eventUrl: input.values.eventUrl || null,
          postingMethod,
          status: "PENDING",
          ...(tagConnects.length > 0 ? { tags: { connect: tagConnects } } : {}),
        },
      });

      if (input.imageUpload) {
        await claimEventImageUpload(tx, {
          uploadId: input.imageUpload.id,
          userId: user.id,
          eventId: created.id,
        });
      }

      return created;
    });
  } catch (error) {
    if (error?.code === "EVENT_CATEGORY_UNAVAILABLE") return { error: error.message, fieldErrors: { category: error.message } };
    if (error?.code === "CITY_UNAVAILABLE") return { error: error.message, fieldErrors: { city: error.message } };
    console.error("[events] event creation failed:", error);
    if (isEventImageUploadClaimError(error)) {
      return {
        error: "Please upload the event image again.",
        fieldErrors: { imageUrl: error.message },
      };
    }
    return { error: "Failed to create the event. Please try again.", fieldErrors: {} };
  }

  revalidateEventPaths(event.id);

  redirect("/dashboard/events?created=1");
}

export async function retryEventCheckoutAction() {
  await requireUser();
  // Old bookmarked forms cannot start a retired event purchase.
  redirect("/dashboard/events?payment=unavailable");
}

export async function resubmitEventAction(formData) {
  const user = await requireUser();
  const eventId = getTextValue(formData, "eventId");
  if (!eventId) redirect("/dashboard/events?resubmit=invalid");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      business: { select: { id: true, ownerId: true, status: true, deletedAt: true } },
      payments: {
        where: { status: "PAID" },
        orderBy: { paidAt: "asc" },
        take: 1,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { decision: true },
      },
    },
  });

  if (!event || event.deletedAt || (event.creatorId !== user.id && user.role !== "ADMIN")) {
    redirect("/dashboard/events?resubmit=invalid");
  }
  if (
    event.status !== "DRAFT" ||
    event.reviews[0]?.decision !== "DENIED" ||
    !event.endDate ||
    isEventPast(event)
  ) {
    redirect("/dashboard/events?resubmit=invalid");
  }

  if (event.postingMethod === "ONE_TIME") {
    const payment = event.payments[0];
    if (
      !payment ||
      !payment.eventStartDate ||
      !payment.eventEndDate ||
      event.startDate < payment.eventStartDate ||
      event.endDate > payment.eventEndDate
    ) {
      redirect("/dashboard/events?resubmit=payment");
    }
  } else if (["SUBSCRIPTION", "LEGACY"].includes(event.postingMethod) && !isStaffRole(user.role)) {
    const billingState = await getAccountAccess(user.id).catch(() => null);
    if (
      !billingState?.hasMembershipAccess ||
      (event.postingMethod === "SUBSCRIPTION" && (
        !event.business || event.business.deletedAt ||
        event.business.ownerId !== user.id || event.business.status !== "ACTIVE"
      ))
    ) {
      redirect("/dashboard/events?resubmit=membership");
    }
  }

  const resubmitted = await prisma.event.updateMany({
    where: {
      id: event.id,
      deletedAt: null,
      ...(user.role === "ADMIN" ? {} : { creatorId: user.id }),
      status: "DRAFT",
      updatedAt: event.updatedAt,
    },
    data: { status: "PENDING" },
  });
  if (resubmitted.count !== 1) {
    redirect("/dashboard/events?resubmit=conflict");
  }

  revalidateEventPaths(event.id);
  redirect("/dashboard/events?resubmitted=1");
}

export async function updateEventAction(prevState, formData) {
  const user = await requireUser();
  const eventId = getTextValue(formData, "eventId");
  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : null;

  if (!event || event.deletedAt || (event.creatorId !== user.id && user.role !== "ADMIN")) {
    return { error: "Event not found.", fieldErrors: {} };
  }

  if (["CANCELLED", "DENIED"].includes(event.status)) {
    return {
      error: "Canceled or denied events cannot be reused. Create a new event post instead.",
      fieldErrors: {},
    };
  }

  const input = await getValidatedEventInput(formData, user, event);
  if (input.error) return input;

  if (input.recurrence.recurrence === "WEEKLY" && event.postingMethod === "ONE_TIME") {
    return { error: "This existing event cannot become a recurring series. Create a new event linked to your business profile instead.", fieldErrors: { recurrence: "Recurring events require a membership post." } };
  }

  if (["SUBSCRIPTION", "LEGACY"].includes(event.postingMethod) && !isStaffRole(user.role)) {
    const billingState = await getAccountAccess(user.id).catch(() => null);
    if (
      !billingState?.hasMembershipAccess ||
      (event.postingMethod === "SUBSCRIPTION" && (
        !input.business || input.business.ownerId !== user.id
      ))
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

  if (event.postingMethod === "ONE_TIME" && event.status === "DRAFT") {
    try {
      await expireOpenEventCheckoutSessions(event.id);
    } catch (error) {
      console.error("[events] active Checkout could not be closed before edit:", error);
      return {
        error: "Stripe is still processing this event payment. Wait for it to finish before editing.",
        fieldErrors: {},
      };
    }
  }

  let replacedUploadIds = [];
  try {
    replacedUploadIds = await prisma.$transaction(async (tx) => {
      const location = await resolveEventCity(tx, input.values, event);
      const { categoryId, categoryTagNames } = await resolveEventCategories(tx, input.values);
      const tagConnects = await upsertEventTags(tx, [...categoryTagNames, ...input.tagNames]);
      const updated = await tx.event.updateMany({
        where: {
          id: event.id,
          deletedAt: null,
          ...(user.role === "ADMIN" ? {} : { creatorId: user.id }),
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
          ...location,
          categoryId,
          businessId: input.business?.id ?? null,
          startDate: input.schedule.startDate,
          endDate: input.schedule.endDate,
          timezone: input.schedule.timezone,
          ...input.recurrence,
          eventUrl: input.values.eventUrl || null,
          status: event.status,
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

      if (input.imageChanged) {
        return replaceEventImageUpload(tx, {
          eventId: event.id,
          userId: user.id,
          uploadId: input.imageUpload?.id ?? null,
        });
      }

      return [];
    });
  } catch (error) {
    if (error?.code === "EVENT_CATEGORY_UNAVAILABLE") return { error: error.message, fieldErrors: { category: error.message } };
    if (error?.code === "CITY_UNAVAILABLE") return { error: error.message, fieldErrors: { city: error.message } };
    console.error("[events] event update failed:", error);
    if (isEventImageUploadClaimError(error)) {
      return {
        error: "Please upload the event image again.",
        fieldErrors: { imageUrl: error.message },
      };
    }
    if (error?.code === "EVENT_EDIT_CONFLICT") {
      return {
        error: "This event changed in another request. Reload the page before editing again.",
        fieldErrors: {},
      };
    }
    return { error: "Failed to update the event. Please try again.", fieldErrors: {} };
  }

  if (replacedUploadIds.length > 0) {
    try {
      const cleanup = await cleanupEventImageUploadsByIds(replacedUploadIds);
      if (cleanup.failed > 0) {
        console.error(
          `[events] ${cleanup.failed} replaced event image(s) remain queued for cleanup.`,
        );
      }
    } catch (error) {
      console.error("[events] replaced event image cleanup deferred:", error);
    }
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
    select: { id: true, creatorId: true, startDate: true, endDate: true, timezone: true, recurrence: true, recurrenceUntil: true, deletedAt: true },
  });
  if (!event || event.deletedAt || (event.creatorId !== user.id && user.role !== "ADMIN")) return;
  if (isEventPast(event)) return;

  try {
    await cancelEventPosting(eventId);
  } catch (error) {
    console.error("[events] event cancellation could not finish:", error);
    redirect("/dashboard/events?cancel=blocked");
  }

  revalidateEventPaths(eventId);
  redirect("/dashboard/events?canceled=1");
}
