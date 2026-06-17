import { redirect } from "next/navigation";

import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";
import { FavoritesDashboard } from "./FavoritesDashboard";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

export default async function FavoritesPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  let favorites = [];
  let schemaNotice = null;

  try {
    favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            status: true,
            city: {
              select: {
                name: true,
                slug: true,
              },
            },
            plan: {
              select: {
                name: true,
                slug: true,
              },
            },
            photos: {
              orderBy: { order: "asc" },
              take: 1,
              select: {
                url: true,
                alt: true,
              },
            },
            categories: {
              select: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    schemaNotice = phase3SchemaMessage;
  }

  const favoriteItems = favorites
    .filter((favorite) => favorite.business)
    .map((favorite) => ({
      id: favorite.id,
      createdAt: favorite.createdAt.toISOString(),
      businessId: favorite.business.id,
      businessSlug: favorite.business.slug,
      name: favorite.business.name,
      description: favorite.business.description,
      status: favorite.business.status,
      cityName: favorite.business.city?.name ?? "Texas",
      citySlug: favorite.business.city?.slug ?? "",
      planName: favorite.business.plan?.name ?? "Free",
      planSlug: favorite.business.plan?.slug ?? "free",
      photoUrl: favorite.business.photos[0]?.url ?? "",
      photoAlt: favorite.business.photos[0]?.alt ?? favorite.business.name,
      categories: favorite.business.categories.map((entry) => ({
        id: entry.category.id,
        name: entry.category.name,
        slug: entry.category.slug,
      })),
    }));

  return (
    <DashboardLayout activeTab="businesses-saved">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Saved Businesses</h1>
          <p className={styles.pageSubtitle}>
            Keep your saved business listings in one easy place.
          </p>
        </div>
      </div>

      {schemaNotice ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Favorites Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Apply the schema update and saved places will load here.
            </p>
          </div>
        </div>
      ) : (
        <FavoritesDashboard
          favorites={favoriteItems}
          emptyTitle="No saved businesses yet"
          emptyDescription="Tap the heart on any listing to build your own shortlist of saved businesses."
          emptyActionLabel="Explore Businesses"
          statsLabel="Saved Businesses"
        />
      )}
    </DashboardLayout>
  );
}
