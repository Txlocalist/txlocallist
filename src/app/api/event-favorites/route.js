/**
 * POST /api/event-favorites
 * Body: { eventId: string }
 *
 * Toggles the current user's save on a published event and returns the
 * authoritative aggregate count.
 */

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export async function POST(request) {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  let eventId;
  try {
    ({ eventId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof eventId !== "string" || !eventId.trim()) {
    return Response.json({ error: "eventId is required" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: "PUBLISHED" },
    select: { id: true },
  });

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    if (!prisma.eventFavorite) {
      return Response.json(
        { error: "Saved events are not available until the database migration is applied." },
        { status: 503 }
      );
    }

    const key = { userId_eventId: { userId: user.id, eventId: event.id } };
    const existing = await prisma.eventFavorite.findUnique({ where: key });

    if (existing) {
      await prisma.eventFavorite.delete({ where: key });
    } else {
      await prisma.eventFavorite.create({
        data: { userId: user.id, eventId: event.id },
      });
    }

    const count = await prisma.eventFavorite.count({
      where: { eventId: event.id },
    });

    return Response.json({ saved: !existing, count });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      return Response.json(
        { error: "Saved events are not available until the database migration is applied." },
        { status: 503 }
      );
    }

    throw error;
  }
}
