/**
 * GET /api/events?city=Austin&limit=6
 * Returns published events optionally filtered by city.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicEventWhere } from "@/lib/event-dates";
import { prisma } from "@/lib/prisma";
import { isUnavailablePrismaRelationError } from "@/lib/prisma-errors";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city  = searchParams.get("city")  ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 20);

  try {
    const user = await getCurrentUser().catch(() => null);
    const where = getPublicEventWhere();
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    const findEvents = (includeLikes) => prisma.event.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        addressName: true,
        address: true,
        city: true,
        state: true,
        startDate: true,
        endDate: true,
        timezone: true,
        tags: { select: { name: true } },
        business: { select: { name: true, slug: true } },
        ...(includeLikes
          ? {
              _count: { select: { likes: true } },
              ...(user
                ? { likes: { where: { userId: user.id }, select: { id: true } } }
                : {}),
            }
          : {}),
      },
    });

    let events;
    try {
      events = await findEvents(true);
    } catch (error) {
      if (!isUnavailablePrismaRelationError(error, "likes")) throw error;
      events = await findEvents(false);
    }

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        likesCount: event._count?.likes ?? 0,
        isLiked: Boolean(event.likes?.length),
        _count: undefined,
        likes: undefined,
      })),
    });
  } catch (err) {
    // Silently return empty if table doesn't exist yet
    console.error("[api/events]", err);
    return NextResponse.json({ events: [] });
  }
}
