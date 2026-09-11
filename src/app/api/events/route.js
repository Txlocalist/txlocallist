import { resultOrderBy } from "@/lib/results-sort";
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
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "6", 10) || 6));
  const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const sort = searchParams.get("sort");
  const q = searchParams.get("q")?.trim();

  try {
    const user = await getCurrentUser().catch(() => null);
    const where = getPublicEventWhere();
    if (city) {
      const cityName = city.replace(/,?\s+(?:TX|Texas)$/i, "").trim();
      where.city = { contains: cityName, mode: "insensitive" };
    }

    if (q) where.AND.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] });

    const findEvents = (includeLikes) => prisma.event.findMany({
      where,
      orderBy: resultOrderBy(sort, { name: "sortName", fallback: "upcoming", extras: ["upcoming"] }),
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
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

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      (async () => {
        try {
          return await findEvents(true);
        } catch (error) {
          if (!isUnavailablePrismaRelationError(error, "likes")) throw error;
          return findEvents(false);
        }
      })(),
    ]);

    return NextResponse.json({
      total, page, pageSize: limit, hasMore: page * limit < total,
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
