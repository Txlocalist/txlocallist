import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { TOP_RATED_LOCAL_SLUGS } from "@/lib/directory-demo";
import { prisma } from "@/lib/prisma";

const BUSINESS_CARD_INCLUDE = {
  city: { select: { name: true } },
  photos: { orderBy: { order: "asc" }, take: 1 },
  categories: {
    take: 1,
    include: { category: { select: { name: true } } },
  },
};

function toBusinessCard(business) {
  return {
    slug: business.slug,
    name: business.name,
    city: business.city.name.toUpperCase(),
    description: business.description,
    category: business.categories[0]?.category.name ?? "Local Business",
    imageUrl: business.photos[0]?.url,
    imageAlt: business.photos[0]?.alt ?? business.name,
  };
}

export async function getTopRatedLocals() {
  try {
    // Seeded records should be discoverable regardless of which account seeded
    // them. Restricting this to a development-only owner made production render
    // an empty showcase when the same listings were imported under another user.
    const seededBusinesses = await prisma.business.findMany({
      where: {
        slug: { in: TOP_RATED_LOCAL_SLUGS },
        ...getPublicBusinessWhere(),

      },
      include: BUSINESS_CARD_INCLUDE,
    });

    const bySlug = new Map(seededBusinesses.map((business) => [business.slug, business]));
    const seededInDisplayOrder = TOP_RATED_LOCAL_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);

    // Keep the section useful even if the production seed has not been run yet.
    // The preferred seeded listings remain first whenever they exist.
    const remainingSlots = TOP_RATED_LOCAL_SLUGS.length - seededInDisplayOrder.length;
    const fallbackBusinesses = remainingSlots > 0
      ? await prisma.business.findMany({
          where: {
            slug: { notIn: TOP_RATED_LOCAL_SLUGS },
            ...getPublicBusinessWhere(),
          },
          orderBy: { publishedAt: "desc" },
          take: remainingSlots,
          include: BUSINESS_CARD_INCLUDE,
        })
      : [];

    return [...seededInDisplayOrder, ...fallbackBusinesses].map(toBusinessCard);
  } catch (error) {
    console.warn("Unable to load top rated locals:", error.message);
    return [];
  }
}
