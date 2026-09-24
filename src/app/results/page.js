import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";
import { getPublishedEventCityNames } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { mergeCityNames } from "@/lib/cities";
import ResultsExperience from "./ResultsExperience";

export const metadata = {
  title: "Explore | Texas Localist",
  description: "Find local businesses, happenings, and hidden gems across Texas.",
};

function toBusinessResult(business, extra = {}) {
  const planFeatures = JSON.parse(business.plan?.features || "{}");

  return {
    id: business.id,
    slug: business.slug,
    createdAt: business.createdAt.toISOString(),
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
    isHiring: business.isHiring,
    showContact: planFeatures.SHOW_CONTACT,
    showWebsite: planFeatures.SHOW_WEBSITE,
    phone: planFeatures.SHOW_CONTACT ? business.phone : null,
    website: planFeatures.SHOW_WEBSITE ? business.website : null,
    ...extra,
  };
}

function getFavoriteBusinessInclude(userId, includeLikes = true) {
  return {
    business: {
      select: {
        id: true,
        slug: true,
        createdAt: true,
        name: true,
        description: true,
        phone: true,
        website: true,
        isHiring: true,
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
        ...(includeLikes
          ? { likes: { where: { userId }, select: { id: true } } }
          : {}),
      },
    },
  };
}

async function getAvailableCategories() {
  const findCategories = (includeSoftDeletion) => prisma.category.findMany({
    where: {
      businessCategories: {
        some: {
          business: {
            ...getPublicBusinessWhere({ includeSoftDeletion }),
          },
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  try {
    return await findCategories(true);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) throw error;
    return findCategories(false);
  }
}

export default async function ResultsPage({ searchParams }) {
  const params = await searchParams;
  const q   = params?.q   ?? "";
  const loc = params?.loc ?? "";
  const initialCategory = params?.category ?? "";
  const initialBrowseAll = params?.browse === "all";
  const initialJobsOnly = params?.jobs === "1";
  const [availableCategories, managedCities, publishedEventCities, user] = await Promise.all([
    getAvailableCategories(),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getPublishedEventCityNames(),
    getCurrentUser().catch(() => null),
  ]);

  const availableCities = mergeCityNames(
    managedCities.map((city) => city.name),
    publishedEventCities,
  );

  const dashboardPath = user ? getDashboardPath(user.role) : null;

  // Fetch the current user's saved business IDs so the client
  // can render bookmark buttons in the correct state on first load.
  let savedIds = [];
  let favoriteBusinesses = [];
  if (user) {
    const findFavorites = ({ includeLikes, includeSoftDeletion }) => prisma.favorite.findMany({
      where: {
        userId: user.id,
        business: {
          ...getPublicBusinessWhere({ includeSoftDeletion }),
        },
      },
      orderBy: { createdAt: "desc" },
      include: getFavoriteBusinessInclude(user.id, includeLikes),
    });

    const profiles = [
      { includeLikes: true, includeSoftDeletion: true },
      { includeLikes: false, includeSoftDeletion: true },
      { includeLikes: false, includeSoftDeletion: false },
    ];
    let favorites = null;
    for (const [index, profile] of profiles.entries()) {
      try {
        favorites = await findFavorites(profile);
        break;
      } catch (error) {
        if (!isMissingPrismaTableError(error) || index === profiles.length - 1) {
          throw error;
        }
      }
    }
    savedIds = favorites.map((f) => f.businessId);
    favoriteBusinesses = favorites
      .filter((favorite) => favorite.business)
      .map((favorite) =>
        toBusinessResult(favorite.business, {
          savedAt: favorite.createdAt.toISOString(),
        })
      );
  }

  return (
    <ResultsExperience
      initialQuery={q}
      initialLocation={loc}
      initialCategory={initialCategory}
      initialBrowseAll={initialBrowseAll}
      initialJobsOnly={initialJobsOnly}
      user={user}
      dashboardPath={dashboardPath}
      savedIds={savedIds}
      initialFavoriteBusinesses={favoriteBusinesses}
      availableCategories={availableCategories}
      availableCities={availableCities}
    />
  );
}
