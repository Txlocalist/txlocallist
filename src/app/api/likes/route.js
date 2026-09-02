/**
 * PUT /api/likes
 * Body: { businessId: string, liked: boolean }
 *
 * Idempotently sets the current user's like state for a published business and
 * returns the authoritative aggregate count.
 */

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { sendNewLikeEmail } from "@/lib/email";

export async function PUT(request) {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  let businessId;
  let liked;
  try {
    ({ businessId, liked } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof businessId !== "string" || !businessId.trim()) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
  }

  if (typeof liked !== "boolean") {
    return Response.json({ error: "liked must be a boolean" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: {
      id: businessId.trim(),
      status: "ACTIVE",
      publishedAt: { not: null },
    },
    select: { id: true, name: true, slug: true, ownerId: true, owner: { select: { email: true, name: true } } },
  });

  if (!business) {
    return Response.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const key = {
        userId_businessId: {
          userId: user.id,
          businessId: business.id,
        },
      };

      if (liked) {
        const existing = await tx.like.findUnique({ where: key, select: { userId: true } });
        await tx.like.upsert({
          where: key,
          create: { userId: user.id, businessId: business.id },
          update: {},
        });
        const count = await tx.like.count({ where: { businessId: business.id } });
        return { count, created: !existing };
      } else {
        await tx.like.deleteMany({
          where: { userId: user.id, businessId: business.id },
        });
      }
      return { count: await tx.like.count({ where: { businessId: business.id } }), created: false };
    });

    if (liked && result.created && business.ownerId !== user.id && business.owner.email) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      await sendNewLikeEmail({ to: business.owner.email, recipientName: business.owner.name, postTitle: business.name, postType: "business", postUrl: `${site}/business/${business.slug}` });
    }

    return Response.json({ liked, count: result.count });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      return Response.json(
        { error: "Likes are not available until the database migration is applied." },
        { status: 503 }
      );
    }

    throw error;
  }
}
