import { resultOrderBy } from "@/lib/results-sort";
import { getPublicBusinessWhere } from "@/lib/listing-visibility";
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

function getBusinessSelect(userId, includeLikes = true) {
  return {
    id: true,
    slug: true,
    createdAt: true,
    name: true,
    description: true,
    phone: true,
    website: true,
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

    function buildWhere(includeSoftDeletion) {
      const where = {
        ...getPublicBusinessWhere({ includeSoftDeletion }),
      };

      // Strip common state suffixes so "Austin, TX" resolves as "Austin".
      if (loc) {
        const cityOnly = loc.replace(/,?\s+[a-zA-Z]{2}$/, "").trim();
        where.city = {
          OR: [
            { slug: cityOnly.toLowerCase().replace(/\s+/g, "-") },
            { name: { mode: "insensitive", contains: cityOnly } },
          ],
        };
      }

      if (q) {
        where.OR = [
          { name: { mode: "insensitive", contains: q } },
          { description: { mode: "insensitive", contains: q } },
          { tags: { some: { tag: { name: { mode: "insensitive", contains: q } } } } },
        ];
      }

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

      return where;
    }

    // Keep search usable while additive Like and soft-delete migrations are
    // rolling out. The final profile targets the legacy schema exclusively.
    const profiles = [
      { includeLikes: true, includeSoftDeletion: true, includeSortName: true },
      { includeLikes: false, includeSoftDeletion: true, includeSortName: true },
      { includeLikes: false, includeSoftDeletion: false, includeSortName: false },
    ];

    let total = 0;
    let results = [];
    for (const [index, profile] of profiles.entries()) {
      const where = buildWhere(profile.includeSoftDeletion);
      const orderBy = resultOrderBy(sort, {
        name: profile.includeSortName ? "sortName" : "name",
        extras: ["popular"],
      });

      try {
        [total, results] = await Promise.all([
          prisma.business.count({ where }),
          prisma.business.findMany({
            where,
            select: getBusinessSelect(user?.id, profile.includeLikes),
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ]);
        break;
      } catch (error) {
        if (!isMissingPrismaTableError(error) || index === profiles.length - 1) {
          throw error;
        }
      }
    }

    // Transform results for the frontend
    const transformedResults = results.map((business) => ({
      id: business.id,
      slug: business.slug,
      createdAt: business.createdAt,
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
