"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { sendListingPublishedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

/** Suspend a business listing */
export async function suspendBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/posts");
}

/** Activate (unsuspend) a business listing */
export async function activateBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/posts");
}

/** Archive (soft delete) a business listing */
export async function archiveBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/posts");
}

function revalidateAdminModerationPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/events");
}

function mapModerationChoice(choice, entityType) {
  if (choice === "approved") {
    return entityType === "business" ? "ACTIVE" : "PUBLISHED";
  }

  if (choice === "denied") {
    return "DENIED";
  }

  return "PENDING";
}

/** Update moderation status for a business or event */
export async function updatePostModerationStatusAction(formData) {
  await requireAdmin();

  const entityType = formData.get("entityType")?.toString();
  const entityId = formData.get("entityId")?.toString();
  const statusChoice = formData.get("status")?.toString().toLowerCase();

  if (!entityId || !["business", "event"].includes(entityType) || !["pending", "approved", "denied"].includes(statusChoice)) {
    return;
  }

  if (entityType === "business") {
    const business = await prisma.business.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        slug: true,
        name: true,
        publishedAt: true,
        owner: { select: { email: true } },
      },
    });

    if (!business) return;

    const nextStatus = mapModerationChoice(statusChoice, "business");
    const data =
      nextStatus === "ACTIVE"
        ? { status: "ACTIVE", publishedAt: business.publishedAt ?? new Date() }
        : { status: nextStatus, publishedAt: null };

    await prisma.business.update({
      where: { id: entityId },
      data,
    });

    revalidatePath(`/business/${business.slug}`);
    revalidatePath("/dashboard/businesses");
    revalidatePath("/search");
    revalidateAdminModerationPaths();

    if (nextStatus === "ACTIVE" && business.owner?.email) {
      sendListingPublishedEmail({
        to: business.owner.email,
        businessName: business.name,
        businessSlug: business.slug,
      }).catch((error) => console.error("[admin] approval email failed:", error));
    }

    return;
  }

  await prisma.event.update({
    where: { id: entityId },
    data: {
      status: mapModerationChoice(statusChoice, "event"),
    },
  });

  revalidatePath("/events");
  revalidatePath("/dashboard/events");
  revalidateAdminModerationPaths();
}

/** Change a user role */
export async function changeUserRoleAction(formData) {
  await requireAdmin();
  const id   = formData.get("id")?.toString();
  const role = formData.get("role")?.toString();
  if (!id || !["USER", "OWNER", "ADMIN"].includes(role)) return;
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/users");
}

/** Delete an event (admin) */
export async function adminDeleteEventAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.event.delete({ where: { id } });
  revalidatePath("/admin/events");
  revalidatePath("/admin/posts");
  revalidatePath("/dashboard/events");
  revalidatePath("/events");
}

/** Delete a tag */
export async function deleteTagAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.$transaction(async (tx) => {
    await tx.businessTag.deleteMany({
      where: { tagId: id },
    });

    await tx.tag.update({
      where: { id },
      data: {
        events: {
          set: [],
        },
      },
    });

    await tx.tag.delete({ where: { id } });
  });
  revalidatePath("/admin/tags");
}
