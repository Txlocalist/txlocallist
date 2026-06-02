"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Suspend a business listing */
export async function suspendBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin/businesses");
}

/** Activate (unsuspend) a business listing */
export async function activateBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/admin/businesses");
}

/** Archive (soft delete) a business listing */
export async function archiveBusinessAction(formData) {
  await requireAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await prisma.business.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/admin/businesses");
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
