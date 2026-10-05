import { normalizeSort, resultOrderBy, sortResults } from "@/lib/results-sort";
/**
 * GET /api/events?city=Austin&limit=6
 * Returns published events optionally filtered by city.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicEventWhere } from "@/lib/event-dates";
import { prisma } from "@/lib/prisma";
import { isUnavailablePrismaRelationError } from "@/lib/prisma-errors";
import { getNextEventOccurrence, getRecurrenceLabel, isRecurringEvent } from "@/lib/event-recurrence";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city  = searchParams.get("city")  ?? "";
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "6", 10) || 6));
  const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const sort = normalizeSort(searchParams.get("sort"), "upcoming", ["upcoming", "city"]);
  const q = searchParams.get("q")?.trim();

  try {
    const user = await getCurrentUser().catch(() => null);
    const where = getPublicEventWhere();
    if (city) {
      const cityName = city.replace(/,?\s+(?:TX|Texas)$/i, "").trim();
      where.city = { contains: cityName, mode: "insensitive" };
    }

    if (q) where.AND.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] });

    const findEvents = (includeLikes, overrides = {}) => prisma.event.findMany({
      where,
      orderBy: resultOrderBy(sort, { name: "sortName", cityDate: "startDate", fallback: "upcoming", extras: ["upcoming", "city"] }),
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
        recurrence: true,
        recurrenceUntil: true,
        tags: { select: { name: true } },
        category: { select: { id: true, name: true, slug: true } },
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
      ...overrides,
    });

    const queryEvents = async (overrides = {}) => {
        try {
          return await findEvents(true, overrides);
        } catch (error) {
          if (!isUnavailablePrismaRelationError(error, "likes")) throw error;
          return findEvents(false, overrides);
        }
    };
    const projectNext = (event) => {
      if (!isRecurringEvent(event)) return event;
      const next = getNextEventOccurrence(event);
      return next ? { ...event, ...next, recurrenceLabel: getRecurrenceLabel(event) } : null;
    };
    let total;
    let events;
    if (sort === "upcoming" || sort === "city") {
      // Recurring anchors may be years old. Merge their calculated next dates
      // into a bounded single-event page rather than sorting on the anchors or
      // loading the entire one-time events table into memory.
      const singleWhere = { ...where, recurrence: "NONE" };
      const [singleCount, recurringRows] = await Promise.all([
        prisma.event.count({ where: singleWhere }),
        queryEvents({ where: { ...where, recurrence: "WEEKLY" }, skip: 0, take: undefined }),
      ]);
      const recurring = recurringRows.map(projectNext).filter(Boolean);
      const offset = (page - 1) * limit;
      const singleOffset = Math.max(0, offset - recurring.length);
      const singles = await queryEvents({ where: singleWhere, skip: singleOffset, take: limit + recurring.length });
      events = sortResults([...singles, ...recurring], sort, { cityDate: (event) => event.startDate, extras: ["upcoming", "city"] })
        .slice(offset - singleOffset, offset - singleOffset + limit);
      total = singleCount + recurring.length;
    } else {
      [total, events] = await Promise.all([prisma.event.count({ where }), queryEvents()]);
      events = events.map(projectNext).filter(Boolean);
    }

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
