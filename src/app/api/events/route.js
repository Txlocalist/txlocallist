/**
 * GET /api/events?city=Austin&limit=6
 * Returns published events optionally filtered by city.
 */
import { NextResponse } from "next/server";
import { getPublicEventWhere } from "@/lib/event-dates";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city  = searchParams.get("city")  ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 20);

  try {
    const where = getPublicEventWhere();
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    const events = await prisma.event.findMany({
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
      },
    });

    return NextResponse.json({ events });
  } catch (err) {
    // Silently return empty if table doesn't exist yet
    console.error("[api/events]", err);
    return NextResponse.json({ events: [] });
  }
}
