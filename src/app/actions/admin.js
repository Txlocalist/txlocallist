"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { reconcileStripeSubscriptions } from "@/lib/billing";
import { sendListingPublishedEmail } from "@/lib/email";
import {
  approveEventForPublication,
  cancelEventPosting,
  denyEventForRevision,
  issueEventPaymentRefund,
  restoreEventAfterFavorableDispute,
} from "@/lib/event-payments";
import { prisma } from "@/lib/prisma";
import {
  confirmRoleTransition,
  previewRoleTransition,
} from "@/lib/role-transitions";
import {
  deleteUserAccount,
  previewUserDeletion,
} from "@/lib/user-deletion";

/** Suspend a business listing */
export async function suspendBusinessAction(formData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/posts");
}

/** Activate (unsuspend) a business listing */
export async function activateBusinessAction(formData) {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const result = await prisma.business.updateMany({
    where: { id, owner: { deletedAt: null } },
    data: { status: "ACTIVE" },
  });
  if (result.count !== 1) return;
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
  const admin = await requireStaff();

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
        owner: { select: { email: true, deletedAt: true } },
      },
    });

    if (!business || business.owner.deletedAt) return;

    const nextStatus = mapModerationChoice(statusChoice, "business");
    const data =
      nextStatus === "ACTIVE"
        ? { status: "ACTIVE", publishedAt: business.publishedAt ?? new Date() }
        : { status: nextStatus, publishedAt: null };

    const updated = await prisma.business.updateMany({
      where: { id: entityId, owner: { deletedAt: null } },
      data,
    });
    if (updated.count !== 1) return;

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

  if (statusChoice === "approved") {
    await approveEventForPublication({
      eventId: entityId,
      reviewerId: admin.id,
      comment: formData.get("comment")?.toString(),
    });
  } else if (statusChoice === "denied") {
    await denyEventForRevision({
      eventId: entityId,
      reviewerId: admin.id,
      comment: formData.get("comment")?.toString(),
    });
  } else {
    return;
  }

  revalidatePath("/events");
  revalidatePath(`/events/${entityId}`);
  revalidatePath("/dashboard/events");
  revalidateAdminModerationPaths();
}

export async function previewUserRoleChangeAction({ targetUserId, toRole }) {
  const admin = await requireAdmin();
  try {
    const preview = await previewRoleTransition({
      actorId: admin.id,
      targetUserId,
      toRole,
    });
    return { ok: true, preview };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Role change could not be prepared.",
    };
  }
}

export async function confirmUserRoleChangeAction({ operationId, confirmed }) {
  const admin = await requireAdmin();
  try {
    await confirmRoleTransition({ actorId: admin.id, operationId, confirmed });
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/businesses");
    revalidatePath("/search");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Role change could not be completed.",
    };
  }
}

export async function previewUserDeletionAction({ targetUserId }) {
  const admin = await requireAdmin();
  try {
    const preview = await previewUserDeletion({
      actorId: admin.id,
      targetUserId,
    });
    return { ok: true, preview };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Account deletion could not be reviewed.",
    };
  }
}

export async function deleteUserAccountAction({
  targetUserId,
  expectedRoleVersion,
  confirmationEmail,
  confirmed,
}) {
  const admin = await requireAdmin();
  try {
    const deletion = await deleteUserAccount({
      actorId: admin.id,
      targetUserId,
      expectedRoleVersion,
      confirmationEmail,
      confirmed,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/businesses");
    revalidatePath("/admin/events");
    revalidatePath("/admin/posts");
    revalidatePath("/search");
    revalidatePath("/events");
    for (const slug of deletion.businessSlugs) {
      revalidatePath(`/business/${slug}`);
    }
    for (const eventId of deletion.eventIds) {
      revalidatePath(`/events/${eventId}`);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Account deletion could not be completed.",
    };
  }
}

/** Delete an event (admin) */
export async function adminDeleteEventAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await cancelEventPosting(id, "ADMIN");
  revalidatePath("/admin/events");
  revalidatePath("/admin/posts");
  revalidatePath("/dashboard/events");
  revalidatePath("/events");
}

/** Approve and issue one full event-payment refund. */
export async function issueEventPaymentRefundAction(formData) {
  const admin = await requireAdmin();
  const paymentId = formData.get("paymentId")?.toString();
  const reason = formData.get("reason")?.toString();
  const confirmed = formData.get("confirmed")?.toString() === "yes";
  if (!paymentId || !confirmed) {
    throw new Error("Confirm the full refund before issuing it.");
  }

  await issueEventPaymentRefund({ paymentId, adminId: admin.id, reason });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/events");
  revalidatePath("/dashboard/events");
}

/** Return a favorably resolved disputed event to the moderation queue. */
export async function restoreEventAfterDisputeAction(formData) {
  const admin = await requireAdmin();
  const eventId = formData.get("eventId")?.toString();
  if (!eventId) return;

  await restoreEventAfterFavorableDispute({ eventId, adminId: admin.id });
  revalidatePath("/admin/posts");
  revalidatePath("/admin/events");
  revalidatePath("/dashboard/events");
}

/** Pull current subscription state from Stripe for every locally linked account. */
export async function reconcileStripeSubscriptionsAction() {
  await requireAdmin();
  const result = await reconcileStripeSubscriptions();
  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/billing");
  return result;
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
