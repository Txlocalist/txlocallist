import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getBlobImageUrl } from "@/lib/blob";
import { getBusinessHoursDisplayRows } from "@/lib/business-hours";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { Navbar, Footer, LikeCount, SaveButton } from "@/components";
import { getFeatures } from "@/lib/tiers";
import ListingReturnButton from "@/components/ListingReturn/ListingReturnButton";

import ShareButton from "./ShareButton";
import PhotoGallery from "./PhotoGallery";
import BusinessDetails from "./BusinessDetails";
import BusinessContactActions from "./BusinessContactActions";
import HiringBadge from "./HiringBadge";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const business = await prisma.business.findFirst({
    where: {
      slug,
      ...getPublicBusinessWhere(),
    },
    select: { name: true, description: true, city: { select: { name: true } } },
  });
  if (!business) return { title: "Business not found" };
  return {
    title: `${business.name} in ${business.city.name} | Texas Localist`,
    description: business.description,
    openGraph: { title: business.name, description: business.description, type: "website" },
  };
}

// This page renders request-specific save and like state from the session cookie.
// Keep the route dynamic so new slugs and ISR revalidation never switch a static
// render to a cookie-backed dynamic render at runtime.
export const dynamic = "force-dynamic";

function parseHiringRoles(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((role) => role?.toString().trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function BusinessDetailPage({ params }) {
  const { slug } = await params;

  const user = await getCurrentUser().catch(() => null);

  const coreBusiness = await prisma.business.findFirst({
    where: {
      slug,
      ...getPublicBusinessWhere(),
    },
    include: {
      city:        { select: { id: true, name: true, slug: true } },
      plan:        { select: { slug: true, features: true } },
      photos:      { orderBy: { order: "asc" } },
      categories:  { select: { category: { select: { id: true, name: true, slug: true } } } },
      tags:        { select: { tag: { select: { id: true, name: true, slug: true } } } },
    },
  });

  if (!coreBusiness || coreBusiness.status !== "ACTIVE") notFound();

  const [socialLinks, jobs] = await Promise.all([
    prisma.socialLink.findMany({
      where: { businessId: coreBusiness.id },
      orderBy: { order: "asc" },
    }).catch((error) => {
      if (!isMissingPrismaTableError(error)) throw error;
      console.error("[business-detail] SocialLink table is unavailable; hiding social links.");
      return [];
    }),
    prisma.job.findMany({
      where: { businessId: coreBusiness.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }).catch((error) => {
      if (!isMissingPrismaTableError(error)) throw error;
      console.error("[business-detail] Job table is unavailable; hiding jobs.");
      return [];
    }),
  ]);
  const business = { ...coreBusiness, socialLinks, jobs };

  let businessHours = [];
  try {
    businessHours = await prisma.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { dayOfWeek: "asc" },
    });
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }
  }

  const [favoritesCount, userFavorite] = await Promise.all([
    prisma.favorite.count({ where: { businessId: business.id } }),
    user
      ? prisma.favorite.findUnique({
          where: { userId_businessId: { userId: user.id, businessId: business.id } },
        })
      : Promise.resolve(null),
  ]);

  let likesCount = 0;
  let isLiked = false;
  try {
    const [engagementCounts, userLike] = await Promise.all([
      prisma.business.findUnique({
        where: { id: business.id },
        select: { _count: { select: { likes: true } } },
      }),
      user
        ? prisma.like.findUnique({
            where: { userId_businessId: { userId: user.id, businessId: business.id } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    likesCount = engagementCounts?._count.likes ?? 0;
    isLiked = Boolean(userLike);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }
  }
  const isSaved = !!userFavorite;

  const features    = getFeatures(business.plan?.slug ?? "free");
  const showContact = features.SHOW_CONTACT;
  const showWebsite = features.SHOW_WEBSITE;
  const showSocials = features.SHOW_SOCIALS;
  const isPaid      = !!(business.plan?.slug && business.plan.slug !== "free");

  const [heroPhoto] = business.photos;
  const hoursRows = getBusinessHoursDisplayRows(businessHours);

  const mapsQuery = encodeURIComponent(`${business.address}, ${business.city.name}, TX`);
  const mapsUrl   = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const pageUrl   = `https://txlocalist.com/business/${slug}`;
  const hiringRoles = parseHiringRoles(business.hiringRoles);
  const hiringApplyHref = `/business/${slug}/apply`;

  return (
    <>
      <Navbar />

      <main className={styles.pageWrapper}>

        <div className={styles.returnRow}>
          <ListingReturnButton fallbackHref="/results" fallbackLabel="Back to Businesses" />
        </div>

        {/* ── HERO ── */}
        <section className={styles.heroSection}>

          <div className={styles.heroImageWrap}>
            {heroPhoto ? (
              <img
                src={getBlobImageUrl(heroPhoto.url)}
                alt={heroPhoto.alt || business.name}
                className={styles.heroImg}
              />
            ) : (
              <div className={styles.heroPlaceholderBg} />
            )}

            <div className={styles.heroOverlay}>
              <div className={styles.heroTop}>
                <div className={styles.heroBadges}>
                  <span className={styles.badgeCity}>{business.city.name}, Texas</span>
                  {isPaid && (
                    <span className={styles.badgeTier}>{business.plan.slug.toUpperCase()}</span>
                  )}
                </div>
                {business.isHiring ? <HiringBadge /> : null}
              </div>

              {/* Bottom row: title + actions */}
              <div className={styles.heroBottom}>
                <h1 className={styles.heroTitle}>{business.name}</h1>
                <div className={styles.heroActions}>
                  <ShareButton
                    title={business.name}
                    url={pageUrl}
                    iconOnly
                    className={styles.heroShareBtn}
                  />
                  <LikeCount
                    count={likesCount}
                    size="hero"
                    targetType="business"
                    targetId={business.id}
                    targetName={business.name}
                    initialLiked={isLiked}
                    isLoggedIn={Boolean(user)}
                  />
                  <SaveButton
                    businessId={business.id}
                    businessName={business.name}
                    initialSaved={isSaved}
                    initialCount={favoritesCount}
                    isLoggedIn={!!user}
                    size="hero"
                  />
                </div>
              </div>
            </div>
          </div>

          {showContact ? (
            <BusinessContactActions
              phone={business.phone}
              website={showWebsite ? business.website : null}
              businessName={business.name}
            />
          ) : null}
        </section>

        <BusinessDetails
          business={business}
          showContact={showContact}
          showSocials={showSocials}
          hoursRows={hoursRows}
          hiringRoles={hiringRoles}
          hiringApplyHref={hiringApplyHref}
          mapsUrl={mapsUrl}
        />

        {/* ── JOBS ── */}
        {features.JOB_POSTINGS > 0 && business.jobs.length > 0 && (
          <section id="open-positions" className={styles.jobsSection}>
            <p className={styles.eyebrow}>Now Hiring</p>
            <h2 className={styles.jobsSectionTitle}>
              Open Positions ({business.jobs.length})
            </h2>
            <div className={styles.jobGrid}>
              {business.jobs.map((job) => (
                <div key={job.id} className={styles.jobCard}>
                  <div className={styles.jobCardTop}>
                    <h3 className={styles.jobTitle}>{job.title}</h3>
                    {job.salaryMin && job.salaryMax && (
                      <span className={styles.jobSalary}>
                        ${(job.salaryMin / 100).toLocaleString()} – ${(job.salaryMax / 100).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className={styles.jobType}>
                    {job.employmentType.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PHOTO GALLERY */}
        {business.photos.length > 0 && (
          <section className={styles.gallerySection} aria-label="Business photos">
            <PhotoGallery photos={business.photos} businessName={business.name} />
          </section>
        )}

      </main>

      <Footer />
    </>
  );
}
