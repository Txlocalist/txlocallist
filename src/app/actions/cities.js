"use server";

import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { normalizeCityInput } from "@/lib/cities";
import { revalidatePath } from "next/cache";

export async function createCityAction(_previousState, formData) {
  const admin = await requireAdmin();
  const input = normalizeCityInput(formData.get("name"));
  const fail = (message) => ({ error: message, fieldErrors: { name: message }, success: "" });
  if (input.error) return fail(input.error);
  try {
    const existing = await prisma.city.findFirst({ where: { OR: [
      { name: { equals: input.name, mode: "insensitive" } }, { slug: input.slug },
    ] } });
    if (existing) return fail("That city already exists. Choose it from the city list.");
    await prisma.$transaction(async (tx) => {
      const city = await tx.city.create({ data: input });
      await tx.auditLog.create({ data: { actorId: admin.id, action: "create", entity: "City", entityId: city.id } });
    });
  } catch (error) {
    return fail(error?.code === "P2002" ? "That city already exists." : "The city could not be added. Please try again.");
  }
  revalidatePath("/", "layout");
  return { error: "", fieldErrors: {}, success: `${input.name} is now available in business forms and Explore.` };
}
