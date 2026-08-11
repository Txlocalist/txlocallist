/**
 * PUT /api/event-likes
 * Body: { eventId: string, liked: boolean }
 *
 * Idempotently sets the current user's like state for a published event and
 * returns the authoritative aggregate count.
 */

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export async function PUT(request) {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  let eventId;
  let liked;
  try {
    ({ eventId, liked } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof eventId !== "string" || !eventId.trim()) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  if (typeof liked !== "boolean") {
    return Response.json({ error: "liked must be a boolean" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId.trim(), status: "PUBLISHED" },
    select: { id: true },
  });

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    if (!prisma.eventLike) {
      return Response.json(
        { error: "Event likes are not available until the database migration is applied." },
        { status: 503 }
      );
    }

    const count = await prisma.$transaction(async (tx) => {
      const key = {
        userId_eventId: {
          userId: user.id,
          eventId: event.id,
        },
      };

      if (liked) {
        await tx.eventLike.upsert({
          where: key,
          create: { userId: user.id, eventId: event.id },
          update: {},
        });
      } else {
        await tx.eventLike.deleteMany({
          where: { userId: user.id, eventId: event.id },
        });
      }

      return tx.eventLike.count({ where: { eventId: event.id } });
    });

    return Response.json({ liked, count });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      return Response.json(
        { error: "Event likes are not available until the database migration is applied." },
        { status: 503 }
      );
    }

    throw error;
  }
}
