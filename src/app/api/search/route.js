/**
 * GET /api/search?q=keyword&loc=city&category=slug&jobs=1&page=1
 *
 * Search for businesses in the directory.
 *
 * Query params:
 *   - q (optional): keyword search (searched in name, description, tags)
 *   - loc (optional): city slug or name (searched in city.slug or city.name)
 *   - category (optional): category slug
 *   - jobs (optional): set to 1 to require at least one active job
 *   - page (optional): page number (default 1)
 *   - limit (optional): results per page (default 12, maximum 15)
 *
 * Response:
 *   {
 *     success: boolean,
 *     data: {
 *       results: Business[],
 *       total: number,
 *       page: number,
 *       pageSize: number,
 *       hasMore: boolean,
 *     },
 *     error: string (if success === false)
 *   }
 */

import { getCurrentUser } from "@/lib/auth/session";
import { getBusinessSearchPageSize } from "@/lib/business-search";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

function getBusinessInclude(userId, includeLikes = true) {
  return {
    city: { select: { id: true, name: true, slug: true } },
    plan: { select: { slug: true, features: true } },
    photos: { take: 1, orderBy: { order: "asc" } },
    categories: {
      select: { category: { select: { name: true, slug: true } } },
    },
    tags: {
      take: 3,
      select: { tag: { select: { name: true, slug: true } } },
    },
    _count: {
      select: {
        favorites: true,
        ...(includeLikes ? { likes: true } : {}),
        jobs: { where: { status: "ACTIVE" } },
      },
    },
    ...(includeLikes && userId
      ? { likes: { where: { userId }, select: { id: true } } }
      : {}),
  };
}

export async function GET(request) {
  try {
    const user = await getCurrentUser().catch(() => null);
    const searchParams = request.nextUrl.searchParams;
    const q        = searchParams.get("q")?.trim()        || "";
    const loc      = searchParams.get("loc")?.trim()      || "";
    const category = searchParams.get("category")?.trim() || "";
    const sort     = searchParams.get("sort")?.trim()     || "";
    const jobsOnly = searchParams.get("jobs") === "1";
    const page     = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const pageSize = getBusinessSearchPageSize(searchParams.get("limit"));

    // Build the where clause
    const where = {
      status: "ACTIVE", // Only show published listings
      publishedAt: { not: null },
    };

    // Filter by city
    // Strip common state suffixes like ", TX" / ", tx" / " TX" before matching
    // so "Austin, TX" and "Austin, tx" resolve the same as "Austin".
    if (loc) {
      const cityOnly = loc
        .replace(/,?\s+[a-zA-Z]{2}$/, "") // strip ", TX" or " TX" at the end
        .trim();
      where.city = {
        OR: [
          { slug: cityOnly.toLowerCase().replace(/\s+/g, "-") },
          { name: { mode: "insensitive", contains: cityOnly } },
        ],
      };
    }

    // Filter by keyword (search in name, description, tags)
    if (q) {
      where.OR = [
        { name: { mode: "insensitive", contains: q } },
        { description: { mode: "insensitive", contains: q } },
        { tags: { some: { tag: { name: { mode: "insensitive", contains: q } } } } },
      ];
    }

    // Filter by category
    if (category) {
      where.categories = {
        some: {
          category: { slug: category.toLowerCase().replace(/\s+/g, "-") },
        },
      };
    }

    if (jobsOnly) {
      where.jobs = {
        some: { status: "ACTIVE" },
      };
    }

    // Get total count for pagination
    const total = await prisma.business.count({ where });

    // Build orderBy — popular sorts by saved count, default by tier then date
    const orderBy = sort === "popular"
      ? [
          { favorites: { _count: "desc" } },
          { publishedAt: "desc" },
        ]
      : [
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ];

    // Fetch results with pagination. Until the manually-applied Like migration
    // lands, preserve public search and report zero likes instead of returning 500.
    const findBusinesses = (includeLikes) => prisma.business.findMany({
      where,
      include: getBusinessInclude(user?.id, includeLikes),
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    let results;
    try {
      results = await findBusinesses(true);
    } catch (error) {
      if (!isMissingPrismaTableError(error)) {
        throw error;
      }
      results = await findBusinesses(false);
    }

    // Transform results for the frontend
    const transformedResults = results.map((business) => ({
      id: business.id,
      slug: business.slug,
      name: business.name,
      description: business.description,
      city: business.city,
      categories: business.categories.map((bc) => bc.category),
      tags: business.tags.map((bt) => bt.tag),
      image: business.photos[0] || null,
      tier: business.plan?.slug || "free",
      favoritesCount: business._count?.favorites ?? 0,
      likesCount: business._count?.likes ?? 0,
      isLiked: Boolean(business.likes?.length),
      activeJobCount: business._count?.jobs ?? 0,
      // Tier-gated fields
      showContact: JSON.parse(business.plan?.features || "{}").SHOW_CONTACT,
      showWebsite: JSON.parse(business.plan?.features || "{}").SHOW_WEBSITE,
      phone: JSON.parse(business.plan?.features || "{}").SHOW_CONTACT
        ? business.phone
        : null,
      website: JSON.parse(business.plan?.features || "{}").SHOW_WEBSITE
        ? business.website
        : null,
    }));

    const hasMore = (page - 1) * pageSize + pageSize < total;

    return Response.json({
      success: true,
      data: {
        results: transformedResults,
        total,
        page,
        pageSize,
        hasMore,
      },
    });
  } catch (error) {
    console.error("[search API error]", error);

    return Response.json(
      {
        success: false,
        error: "Failed to search businesses. Please try again.",
      },
      { status: 500 }
    );
  }
}
