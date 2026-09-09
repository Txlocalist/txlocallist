import { getPublicBusinessWhere } from "@/lib/listing-visibility";
/**
 * POST /api/favorites
 * Body: { businessId: string }
 *
 * Toggles the current user's save on a business.
 * Returns { saved: boolean, count: number }
 * Returns 401 if not logged in.
 */

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  let businessId;
  try {
    ({ businessId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!businessId) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
  }

  // Toggle: delete if exists, create if not
  const existing = await prisma.favorite.findUnique({
    where: { userId_businessId: { userId: user.id, businessId } },
  });

  if (existing) {
    await prisma.favorite.delete({
      where: { userId_businessId: { userId: user.id, businessId } },
    });
  } else {
    const business = await prisma.business.findFirst({ where: { id: businessId, ...getPublicBusinessWhere() }, select: { id: true } });
    if (!business) return Response.json({ error: "Business not available" }, { status: 404 });
    await prisma.favorite.create({
      data: { userId: user.id, businessId },
    });
  }

  // Return fresh count
  const count = await prisma.favorite.count({ where: { businessId } });

  return Response.json({ saved: !existing, count });
}
