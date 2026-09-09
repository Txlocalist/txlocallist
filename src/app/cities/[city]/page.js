import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Navbar, Footer, SearchBar, BusinessCard } from "@/components";

import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { city: citySlug } = await params;

  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    select: { name: true },
  });

  if (!city) {
    return { title: "City not found" };
  }

  return {
    title: `Local Businesses in ${city.name} | Texas Localist`,
    description: `Discover local businesses, cafes, shops, and more in ${city.name}.`,
    openGraph: {
      title: `Explore ${city.name}`,
      description: `Discover local businesses in ${city.name}`,
    },
  };
}

export async function generateStaticParams() {
  try {
    const cities = await prisma.city.findMany({
      select: { slug: true },
      orderBy: { name: "asc" },
    });

    return cities.map((c) => ({ city: c.slug }));
  } catch (error) {
    console.warn("Skipping city static params generation:", error.message);
    return [];
  }
}

export const dynamic = "force-dynamic"; // Revalidate every hour

export default async function CityPage({ params }) {
  const { city: citySlug } = await params;

  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    include: {
      businesses: {
        where: getPublicBusinessWhere(),
        include: {
          photos: { take: 1 },
          plan: { select: { slug: true, features: true } },
          categories: { select: { category: { select: { name: true, slug: true } } } },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!city) {
    notFound();
  }

  // Group businesses by category for display
  const categoriesMap = new Map();
  city.businesses.forEach((business) => {
    business.categories.forEach((bc) => {
      const categorySlug = bc.category.slug;
      if (!categoriesMap.has(categorySlug)) {
        categoriesMap.set(categorySlug, {
          name: bc.category.name,
          businesses: [],
        });
      }
      categoriesMap.get(categorySlug).businesses.push(business);
    });
  });

  // Top uncategorized businesses
  const uncategorized = city.businesses.filter((b) => b.categories.length === 0);

  return (
    <>
      <Navbar />

      <main className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Discover <br />
              <span className={styles.heroAccent}>{city.name}</span>
            </h1>
            <p className={styles.heroTagline}>
              Find authentic local businesses, cafes, shops, and hidden gems.
            </p>
          </div>
        </section>

        {/* Search Bar (scoped to this city) */}
        <section className={styles.searchSection}>
          <SearchBar
            variant="inline"
            action="/search"
            initialLocation={city.name}
          />
        </section>

        {/* Featured Businesses */}
        {city.businesses.length > 0 && (
          <section className={styles.featuredSection} aria-labelledby="featured-heading">
            <h2 id="featured-heading" className={styles.sectionTitle}>
              Featured in {city.name}
            </h2>

            <div className={styles.businessGrid}>
              {city.businesses.slice(0, 6).map((business) => (
                <BusinessCard
                  key={business.id}
                  business={{
                    slug: business.slug,
                    name: business.name,
                    city: city.name,
                    description: business.description,
                    price: "$",
                    category:
                      business.categories[0]?.category.name || "Local Business",
                    imageUrl: business.photos[0]?.url || "/placeholder.jpg",
                    imageAlt: business.name,
                  }}
                  badgeTone="yellow"
                />
              ))}
            </div>

            {city.businesses.length > 6 && (
              <div className={styles.viewAllContainer}>
                <Link
                  href={`/search?loc=${encodeURIComponent(city.name)}`}
                  className={styles.viewAllLink}
                >
                  See all {city.businesses.length} businesses →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Businesses by Category */}
        {categoriesMap.size > 0 && (
          <section className={styles.categoriesSection}>
            <h2 className={styles.sectionTitle}>Browse by Category</h2>

            <div className={styles.categoriesGrid}>
              {Array.from(categoriesMap.entries()).map(([slug, category]) => (
                <div key={slug} className={styles.categoryBlock}>
                  <h3 className={styles.categoryTitle}>
                    <Link
                      href={`/categories/${slug}?city=${citySlug}`}
                      className={styles.categoryLink}
                    >
                      {category.name}
                    </Link>
                  </h3>
                  <p className={styles.categoryCount}>
                    {category.businesses.length} listing{category.businesses.length !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {city.businesses.length === 0 && (
          <section className={styles.emptyState}>
            <h2>No listings yet in {city.name}</h2>
            <p>Be the first to add your business!</p>
            <Link href="/post-your-business" className={styles.ctaButton}>
              Post Your Business
            </Link>
          </section>
        )}

        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link href="/cities">← All Cities</Link>
        </nav>
      </main>

      <Footer />
    </>
  );
}
