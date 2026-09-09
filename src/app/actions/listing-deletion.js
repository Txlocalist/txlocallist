"use server";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { cancelEventPosting } from "@/lib/event-payments";
import { revalidatePath } from "next/cache";

function refreshListings() {
  revalidatePath("/", "layout");
}

export async function deleteOwnedBusinessAction({ id, confirmed } = {}) {
  const user = await requireUser();
  if (confirmed !== true || typeof id !== "string" || !id) return { success: false, error: "Confirm the business deletion first." };
  const business = await prisma.business.findFirst({ where: { id, ownerId: user.id } });
  if (!business) return { success: false, error: "Business not found." };
  // Removal remains available after billing access ends; editing stays gated.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.business.updateMany({ where: { id, ownerId: user.id, deletedAt: null }, data: { status: "ARCHIVED", deletedAt: new Date() } });
    if (updated.count) await tx.auditLog.create({ data: { actorId: user.id, action: "OWNER_DELETE", entity: "Business", entityId: id } });
  });
  refreshListings();
  return { success: true };
}

export async function deleteOwnedEventAction({ id, confirmed } = {}) {
  const user = await requireUser();
  if (confirmed !== true || typeof id !== "string" || !id) return { success: false, error: "Confirm the event deletion first." };
  const event = await prisma.event.findFirst({ where: { id, creatorId: user.id } });
  if (!event) return { success: false, error: "Event not found." };
  if (!event.deletedAt) {
    try {
      // Includes ended/suspended records while retaining Checkout race safeguards.
      await cancelEventPosting(id, "ORGANIZER", { deleteForOwnerId: user.id });
    } catch {
      return { success: false, error: "A payment is still being resolved. Please retry deletion when it finishes." };
    }
  }
  refreshListings();
  return { success: true };
}
