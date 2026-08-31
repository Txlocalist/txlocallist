import { DIRECTORY_DEMO_OWNER_EMAIL, TOP_RATED_LOCAL_SLUGS } from "@/lib/directory-demo";
import { prisma } from "@/lib/prisma";

export async function getTopRatedLocals() {
  try {
    const businesses = await prisma.business.findMany({
      where: {
        owner: { email: DIRECTORY_DEMO_OWNER_EMAIL, deletedAt: null },
        slug: { in: TOP_RATED_LOCAL_SLUGS },
        status: "ACTIVE",
        publishedAt: { not: null },
      },
      include: {
        city: { select: { name: true } },
        photos: { orderBy: { order: "asc" }, take: 1 },
        categories: {
          take: 1,
          include: { category: { select: { name: true } } },
        },
      },
    });

    const bySlug = new Map(businesses.map((business) => [business.slug, business]));

    return TOP_RATED_LOCAL_SLUGS.map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .map((business) => ({
        slug: business.slug,
        name: business.name,
        city: business.city.name.toUpperCase(),
        description: business.description,
        category: business.categories[0]?.category.name ?? "Local Business",
        imageUrl: business.photos[0]?.url,
        imageAlt: business.photos[0]?.alt ?? business.name,
      }));
  } catch (error) {
    console.warn("Unable to load top rated locals:", error.message);
    return [];
  }
}
