"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";
import { normalizeBusinessHoursInput } from "@/lib/business-hours";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

const MIN_NAME_LENGTH = 3;
const MIN_DESCRIPTION_LENGTH = 20;

function getTextValue(formData, fieldName) {
  return formData.get(fieldName)?.toString().trim() ?? "";
}

function buildErrorState(error, fieldErrors = {}) {
  return {
    error,
    fieldErrors,
  };
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value?.toString().trim()).filter(Boolean))];
}

function normalizeHiringRoles(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => value?.toString().trim()).filter(Boolean))];
}

function parseStoredHiringRoles(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeHiringRoles(parsed);
  } catch {
    return [];
  }
}

/**
 * Generate a unique slug from business name and city.
 * Format: "business-name-city"
 */
function generateSlug(name, city) {
  return slugify(`${name}-${city}`);
}

/**
 * Create a new business listing (starts in DRAFT status, Free tier).
 *
 * Form fields:
 *   - name (required)
 *   - description (required, min 20 chars)
 *   - address (required)
 *   - addressName (required)
 *   - zipCode (required)
 *   - cityId (required, foreign key to City)
 *   - state (optional, defaults to "Texas")
 *   - country (optional, defaults to "USA")
 *   - phone (optional)
 *   - email (optional)
 *   - website (optional, must be valid URL)
 *   - isHiring (optional, boolean checkbox)
 *   - categoryIds (optional, comma-separated or array)
 *   - tagIds (optional, comma-separated or array)
 *   - photoUrl (optional, must be valid URL)
 *   - photoAlt (optional, alt text for photo)
 */
export async function createBusinessAction(_prevState, formData) {
  const user = await requireUser();

  const billingState = await getOwnerBillingState(user.id);
  if (!billingState?.hasPaidAccess) {
    return buildErrorState("Upgrade to the paid plan before creating a listing.");
  }

  // Extract form fields
  const name = getTextValue(formData, "name");
  const description = getTextValue(formData, "description");
  const address = getTextValue(formData, "address");
  const addressName = getTextValue(formData, "addressName");
  const zipCode = getTextValue(formData, "zipCode");
  const cityId = getTextValue(formData, "cityId");
  const state = getTextValue(formData, "state") || "Texas";
  const country = getTextValue(formData, "country") || "USA";
  const phone = getTextValue(formData, "phone");
  const email = getTextValue(formData, "email");
  const website = getTextValue(formData, "website");
  const isHiring = formData.get("isHiring") === "on";
  const hiringRoles = normalizeHiringRoles(formData.getAll("hiringRoles"));
  const photoUrl = getTextValue(formData, "photoUrl");
  const photoAlt = getTextValue(formData, "photoAlt") || name;

  // Parse category and tag IDs (support both comma-separated strings and arrays)
  const categoryIds = [
    ...new Set(
      formData
        .getAll("categoryIds")
        .map((v) => v.toString().trim())
        .filter(Boolean)
    ),
  ];
  const tagIds = [
    ...new Set(
      formData
        .getAll("tagIds")
        .map((v) => v.toString().trim())
        .filter(Boolean)
    ),
  ];

  const fieldErrors = {};

  // Validation
  if (name.length < MIN_NAME_LENGTH) {
    fieldErrors.name = `Use at least ${MIN_NAME_LENGTH} characters for the name.`;
  }

  if (description.length < MIN_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Use at least ${MIN_DESCRIPTION_LENGTH} characters for the description.`;
  }

  if (!address) {
    fieldErrors.address = "Enter the street address.";
  }

  if (!addressName) {
    fieldErrors.addressName = "Enter the venue or address name.";
  }

  if (!zipCode) {
    fieldErrors.zipCode = "Enter the ZIP or postal code.";
  }

  if (!cityId) {
    fieldErrors.cityId = "Select a city.";
  }

  if (website && !isValidHttpUrl(website)) {
    fieldErrors.website = "Enter a valid website URL starting with http:// or https://.";
  }

  if (photoUrl && !isValidHttpUrl(photoUrl)) {
    fieldErrors.photoUrl = "Enter a valid photo URL starting with http:// or https://.";
  }

  if (isHiring && hiringRoles.length === 0) {
    fieldErrors.hiringRoles = "Add at least one hiring role when hiring is enabled.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return buildErrorState("Fix the highlighted fields and try again.", fieldErrors);
  }

  // Verify city exists
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) {
    return buildErrorState("Selected city not found.", { cityId: "City does not exist." });
  }

  // Verify categories exist (if any selected)
  if (categoryIds.length > 0) {
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });

    if (selectedCategories.length !== categoryIds.length) {
      return buildErrorState("One or more selected categories are no longer available.", {
        categoryIds: "Reload the page and select categories again.",
      });
    }
  }

  // Verify tags exist (if any selected)
  if (tagIds.length > 0) {
    const selectedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });

    if (selectedTags.length !== tagIds.length) {
      return buildErrorState("One or more selected tags are no longer available.", {
        tagIds: "Reload the page and select tags again.",
      });
    }
  }

  if (!billingState.activePlanId) {
    return buildErrorState("System error: Paid plan not found. Please contact support.");
  }

  // Generate unique slug
  const baseSlug = generateSlug(name, city.name);
  let slug = baseSlug;
  let slugCounter = 1;

  // Check for slug conflicts (within the same city) and increment if needed
  while (
    await prisma.business.findFirst({
      where: { slug, cityId },
    })
  ) {
    slug = `${baseSlug}-${slugCounter}`;
    slugCounter++;
  }

  // Create the business
  const business = await prisma.business.create({
    data: {
      slug,
      name,
      description,
      address,
      addressName,
      zipCode,
      cityId,
      state,
      country,
      phone: phone || null,
      email: email || null,
      website: website || null,
      isHiring,
      hiringRoles: JSON.stringify(hiringRoles),
      ownerId: user.id,
      planId: billingState.activePlanId,
      status: "DRAFT",
      // Attach categories
      categories:
        categoryIds.length > 0
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      // Attach tags
      tags:
        tagIds.length > 0
          ? {
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      // Create initial photo if provided
      photos:
        photoUrl
          ? {
              create: [
                {
                  url: photoUrl,
                  alt: photoAlt,
                  order: 0,
                },
              ],
            }
          : undefined,
    },
  });

  revalidatePath("/dashboard/businesses");
  revalidatePath("/search");

  // Redirect to the edit page so they can add more photos and publish
  redirect(`/dashboard/businesses/${business.id}/edit?created=1`);
}

/**
 * Submit a business listing for admin review.
 */
export async function publishBusinessAction(businessId) {
  const user = await requireUser();
  const billingState = await getOwnerBillingState(user.id);

  if (!billingState?.hasPaidAccess) {
    return { success: false, message: "Upgrade to the paid plan before submitting a listing." };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      ownerId: true,
      status: true,
      slug: true,
      name: true,
      owner: { select: { email: true } },
    },
  });

  if (!business) {
    return { success: false, message: "Business not found." };
  }

  if (business.ownerId !== user.id && user.role !== "ADMIN") {
    return { success: false, message: "You don't have permission to submit this business." };
  }

  if (business.status === "ACTIVE") {
    return { success: false, message: "Business is already approved and live." };
  }

  if (business.status === "PENDING") {
    return { success: false, message: "Business is already waiting for admin review." };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      status: "PENDING",
      publishedAt: null,
    },
  });

  revalidatePath(`/business/${business.slug}`);
  revalidatePath("/search");
  revalidatePath("/dashboard/businesses");

  return { success: true, message: "Business submitted for review." };
}

/**
 * Pause a business listing (changes status from ACTIVE → PAUSED).
 */
export async function pauseBusinessAction(businessId) {
  const user = await requireUser();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true, status: true },
  });

  if (!business) {
    return buildErrorState("Business not found.");
  }

  if (business.ownerId !== user.id && user.role !== "ADMIN") {
    return buildErrorState("You don't have permission to pause this business.");
  }

  if (business.status !== "ACTIVE") {
    return buildErrorState("Only active listings can be paused.");
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { status: "PAUSED" },
  });

  revalidatePath(`/business/${businessId}`);
  revalidatePath("/search");

  return { success: true, message: "Business paused successfully." };
}

/**
 * Archive a business listing (soft-delete).
 */
export async function archiveBusinessAction(businessId) {
  const user = await requireUser();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });

  if (!business) {
    return buildErrorState("Business not found.");
  }

  if (business.ownerId !== user.id && user.role !== "ADMIN") {
    return buildErrorState("You don't have permission to archive this business.");
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/dashboard/businesses");

  return { success: true, message: "Business archived." };
}

/**
 * Create a business from form data (plain object format).
 * Used by the dashboard create form component.
 */
export async function createBusinessFromFormAction(data) {
  const user = await requireUser();
  const categoryIds = normalizeIdList(data.categoryIds);
  const tagIds = normalizeIdList(data.tagIds);
  const isHiring = Boolean(data.isHiring);
  const hiringRoles = normalizeHiringRoles(data.hiringRoles);

  const billingState = await getOwnerBillingState(user.id);
  if (!billingState?.hasPaidAccess) {
    return { success: false, message: "Upgrade to the paid plan before creating a listing." };
  }

  // Validation
  if (!data.name || data.name.trim().length < MIN_NAME_LENGTH) {
    return { success: false, message: `Business name must be at least ${MIN_NAME_LENGTH} characters.` };
  }

  if (!data.description || data.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return { success: false, message: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.` };
  }

  if (!data.cityId) {
    return { success: false, message: "City is required." };
  }

  if (!data.address || !data.address.trim()) {
    return { success: false, message: "Address is required." };
  }

  if (data.website && !isValidHttpUrl(data.website)) {
    return { success: false, message: "Enter a valid website URL." };
  }

  if (isHiring && hiringRoles.length === 0) {
    return { success: false, message: "Add at least one hiring role when hiring is enabled." };
  }

  // Verify city exists
  const city = await prisma.city.findUnique({ where: { id: data.cityId } });
  if (!city) {
    return { success: false, message: "Selected city not found." };
  }

  // Verify categories exist
  if (categoryIds.length > 0) {
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });

    if (selectedCategories.length !== categoryIds.length) {
      return { success: false, message: "One or more selected categories are no longer available." };
    }
  }

  // Verify tags exist
  if (tagIds.length > 0) {
    const selectedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });

    if (selectedTags.length !== tagIds.length) {
      return { success: false, message: "One or more selected tags are no longer available." };
    }
  }

  let normalizedHours = [];

  try {
    normalizedHours = normalizeBusinessHoursInput(data.hours);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Enter valid business hours and try again.",
    };
  }

  const lat =
    typeof data.latitude === "number"
      ? data.latitude
      : data.latitude
        ? parseFloat(data.latitude)
        : null;
  const lng =
    typeof data.longitude === "number"
      ? data.longitude
      : data.longitude
        ? parseFloat(data.longitude)
        : null;
  const inferredZipCode = data.address?.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";

  if (!billingState.activePlanId) {
    return { success: false, message: "System error: Paid plan not found. Please contact support." };
  }

  // Generate unique slug
  const baseSlug = generateSlug(data.name, city.name);
  let slug = baseSlug;
  let slugCounter = 1;

  while (
    await prisma.business.findFirst({
      where: { slug, cityId: data.cityId },
    })
  ) {
    slug = `${baseSlug}-${slugCounter}`;
    slugCounter++;
  }

  try {
    const business = await prisma.$transaction(async (tx) => {
      const createdBusiness = await tx.business.create({
        data: {
          slug,
          name: data.name.trim(),
          description: data.description.trim(),
          addressName: data.addressName?.trim() || data.name.trim(),
          address: data.address.trim(),
          zipCode: data.zipCode?.trim() || inferredZipCode,
          cityId: data.cityId,
          phone: data.phone?.trim() || null,
          email: data.email?.trim().toLowerCase() || null,
          website: data.website?.trim() || null,
          isHiring,
          hiringRoles: JSON.stringify(hiringRoles),
          lat,
          lng,
          ownerId: user.id,
          planId: billingState.activePlanId,
          status: "DRAFT",
          categories:
            categoryIds.length > 0
              ? {
                  create: categoryIds.map((categoryId) => ({ categoryId })),
                }
              : undefined,
          tags:
            tagIds.length > 0
              ? {
                  create: tagIds.map((tagId) => ({ tagId })),
                }
              : undefined,
          photos:
            data.photos && data.photos.length > 0
              ? {
                  create: data.photos.map((photo, i) => ({
                    url: photo.url,
                    alt: photo.name || data.name?.trim() || "",
                    order: i,
                  })),
                }
              : undefined,
        },
      });

      if (normalizedHours.length > 0) {
        await tx.businessHours.createMany({
          data: normalizedHours.map((entry) => ({
            businessId: createdBusiness.id,
            dayOfWeek: entry.dayOfWeek,
            openTime: entry.openTime,
            closeTime: entry.closeTime,
            isClosed: entry.isClosed,
          })),
        });
      }

      return createdBusiness;
    });

    revalidatePath("/dashboard/businesses");
    revalidatePath("/search");

    return {
      success: true,
      message: "Business created successfully!",
      data: { id: business.id },
    };
  } catch (error) {
    console.error("Error creating business:", error);
    if (isMissingPrismaTableError(error)) {
      return {
        success: false,
        message: `${phase3SchemaMessage} Run the Prisma schema update before saving business hours.`,
      };
    }
    return { success: false, message: "Failed to create business. Please try again." };
  }
}

/**
 * Update an existing business listing.
 * Used by the dashboard edit form.
 */
export async function updateBusinessAction(businessId, data) {
  const user = await requireUser();
  const categoryIds = normalizeIdList(data.categoryIds);
  const tagIds = normalizeIdList(data.tagIds);
  const isHiring = Boolean(data.isHiring);
  const hiringRoles = normalizeHiringRoles(data.hiringRoles);

  // Verify ownership
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true, slug: true },
  });

  if (!business) {
    return { success: false, message: "Business not found." };
  }

  if (business.ownerId !== user.id && user.role !== "ADMIN") {
    return { success: false, message: "You don't have permission to edit this business." };
  }

  // Validation
  if (!data.name || data.name.trim().length < MIN_NAME_LENGTH) {
    return { success: false, message: `Business name must be at least ${MIN_NAME_LENGTH} characters.` };
  }

  if (!data.description || data.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return { success: false, message: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.` };
  }

  if (!data.cityId) {
    return { success: false, message: "City is required." };
  }

  if (!data.address || !data.address.trim()) {
    return { success: false, message: "Address is required." };
  }

  if (data.website && !isValidHttpUrl(data.website)) {
    return { success: false, message: "Enter a valid website URL." };
  }

  if (isHiring && hiringRoles.length === 0) {
    return { success: false, message: "Add at least one hiring role when hiring is enabled." };
  }

  // Verify city exists
  const city = await prisma.city.findUnique({ where: { id: data.cityId } });
  if (!city) {
    return { success: false, message: "Selected city not found." };
  }

  // Verify categories exist
  if (categoryIds.length > 0) {
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });

    if (selectedCategories.length !== categoryIds.length) {
      return { success: false, message: "One or more selected categories are no longer available." };
    }
  }

  // Verify tags exist
  if (tagIds.length > 0) {
    const selectedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });

    if (selectedTags.length !== tagIds.length) {
      return { success: false, message: "One or more selected tags are no longer available." };
    }
  }

  let normalizedHours = null;

  try {
    normalizedHours = Array.isArray(data.hours) ? normalizeBusinessHoursInput(data.hours) : null;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Enter valid business hours and try again.",
    };
  }

  const lat =
    typeof data.latitude === "number"
      ? data.latitude
      : data.latitude
        ? parseFloat(data.latitude)
        : null;
  const lng =
    typeof data.longitude === "number"
      ? data.longitude
      : data.longitude
        ? parseFloat(data.longitude)
        : null;

  // Update business
  try {
    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: {
          name: data.name.trim(),
          description: data.description.trim(),
          phone: data.phone || null,
          email: data.email?.trim().toLowerCase() || null,
          website: data.website?.trim() || null,
          isHiring,
          hiringRoles: JSON.stringify(hiringRoles),
          address: data.address.trim(),
          cityId: data.cityId,
          lat,
          lng,
          categories:
            categoryIds.length > 0
              ? {
                  deleteMany: {},
                  create: categoryIds.map((categoryId) => ({ categoryId })),
                }
              : undefined,
          tags:
            tagIds.length > 0
              ? {
                  deleteMany: {},
                  create: tagIds.map((tagId) => ({ tagId })),
                }
              : { deleteMany: {} },
        },
      });

      if (normalizedHours) {
        await tx.businessHours.deleteMany({
          where: { businessId },
        });

        if (normalizedHours.length > 0) {
          await tx.businessHours.createMany({
            data: normalizedHours.map((entry) => ({
              businessId,
              dayOfWeek: entry.dayOfWeek,
              openTime: entry.openTime,
              closeTime: entry.closeTime,
              isClosed: entry.isClosed,
            })),
          });
        }
      }
    });

    revalidatePath("/dashboard/businesses");
    revalidatePath(`/business/${business.slug}`);
    revalidatePath("/search");

    return { success: true, message: "Business updated successfully!" };
  } catch (error) {
    console.error("Error updating business:", error);
    if (isMissingPrismaTableError(error)) {
      return {
        success: false,
        message: `${phase3SchemaMessage} Run the Prisma schema update before saving business hours.`,
      };
    }
    return { success: false, message: "Failed to update business. Please try again." };
  }
}

/**
 * Publish a business from a plain <form> action (reads businessId from FormData).
 * Used on the dashboard businesses list so DRAFT listings can be published
 * with a single button click from a server-rendered page.
 */
export async function publishBusinessFormAction(formData) {
  const businessId = formData.get("businessId")?.toString();
  if (!businessId) return;
  await publishBusinessAction(businessId);
  redirect("/dashboard/businesses?submitted=1");
}

/**
 * Submit a public business application.
 * Used by /business/[slug]/apply.
 */
export async function submitBusinessApplicationAction(data) {
  const slug = data?.slug?.toString().trim() ?? "";
  const firstName = data?.firstName?.toString().trim() ?? "";
  const lastName = data?.lastName?.toString().trim() ?? "";
  const email = data?.email?.toString().trim() ?? "";
  const role = data?.role?.toString().trim() ?? "";
  const resumeUrl = data?.resumeUrl?.toString().trim() ?? "";
  const resumeFileName = data?.resumeFileName?.toString().trim() ?? null;

  if (!slug) {
    return { success: false, message: "Invalid listing." };
  }
  if (!firstName) {
    return { success: false, message: "First name is required." };
  }
  if (!lastName) {
    return { success: false, message: "Last name is required." };
  }
  if (!email || !isValidEmail(email)) {
    return { success: false, message: "Enter a valid email address." };
  }
  if (!resumeUrl || !isValidHttpUrl(resumeUrl)) {
    return { success: false, message: "Upload your resume before applying." };
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      isHiring: true,
      hiringRoles: true,
    },
  });

  if (!business || business.status !== "ACTIVE" || !business.isHiring) {
    return { success: false, message: "This business is not accepting applications right now." };
  }

  const hiringRoles = parseStoredHiringRoles(business.hiringRoles);
  if (hiringRoles.length === 0) {
    return { success: false, message: "No hiring roles are currently available for this listing." };
  }
  if (!role || !hiringRoles.includes(role)) {
    return { success: false, message: "Select a valid role before applying." };
  }

  try {
    await prisma.businessApplication.create({
      data: {
        businessId: business.id,
        firstName,
        lastName,
        email: email.toLowerCase(),
        role,
        resumeUrl,
        resumeFileName,
      },
    });
  } catch (error) {
    console.error("Error submitting business application:", error);
    return { success: false, message: "Failed to submit application. Please try again." };
  }

  return { success: true, message: "Application submitted successfully!" };
}
