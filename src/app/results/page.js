import { getCurrentUser, getDashboardPath } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import ResultsExperience from "./ResultsExperience";

export const metadata = {
  title: "Explore | Texas Localist",
  description: "Find local businesses, events, and hidden gems across Texas.",
};

function toBusinessResult(business, extra = {}) {
  const planFeatures = JSON.parse(business.plan?.features || "{}");

  return {
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
    showContact: planFeatures.SHOW_CONTACT,
    showWebsite: planFeatures.SHOW_WEBSITE,
    phone: planFeatures.SHOW_CONTACT ? business.phone : null,
    website: planFeatures.SHOW_WEBSITE ? business.website : null,
    ...extra,
  };
}

export default async function ResultsPage({ searchParams }) {
  const params = await searchParams;
  const q   = params?.q   ?? "";
  const loc = params?.loc ?? "";
  const [availableTags, activeBusinessCities, publishedEventCities] = await Promise.all([
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.city.findMany({
      where: {
        businesses: {
          some: {
            status: "ACTIVE",
            publishedAt: { not: null },
          },
        },
      },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.event.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["city"],
      select: { city: true },
    }),
  ]);

  const cityNameMap = new Map();

  for (const city of activeBusinessCities) {
    const name = city.name?.trim();
    if (!name) continue;
    cityNameMap.set(name.toLowerCase(), name);
  }

  for (const eventCity of publishedEventCities) {
    const name = eventCity.city?.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (!cityNameMap.has(key)) {
      cityNameMap.set(key, name);
    }
  }

  const availableCities = Array.from(cityNameMap.values()).sort((a, b) =>
    a.localeCompare(b)
  );

  const user = await getCurrentUser().catch(() => null);
  const dashboardPath = user ? getDashboardPath(user.role) : null;

  // Fetch the current user's saved business IDs so the client
  // can render heart buttons in the correct state on first load.
  let savedIds = [];
  let favoriteBusinesses = [];
  if (user) {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        business: {
          status: "ACTIVE",
          publishedAt: { not: null },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        business: {
          include: {
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
            _count: { select: { favorites: true } },
          },
        },
      },
    });
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
      user={user}
      dashboardPath={dashboardPath}
      savedIds={savedIds}
      initialFavoriteBusinesses={favoriteBusinesses}
      availableTags={availableTags}
      availableCities={availableCities}
    />
  );
}
