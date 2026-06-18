import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getBlobImageUrl } from "@/lib/blob";
import { getBusinessHoursDisplayRows } from "@/lib/business-hours";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { Navbar, Footer, SaveButton } from "@/components";
import { getFeatures } from "@/lib/tiers";

import ShareButton from "./ShareButton";
import PhotoGallery from "./PhotoGallery";
import styles from "./page.module.css";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true, description: true, city: { select: { name: true } } },
  });
  if (!business) return { title: "Business not found" };
  return {
    title: `${business.name} in ${business.city.name} | Texas Localist`,
    description: business.description,
    openGraph: { title: business.name, description: business.description, type: "website" },
  };
}

export async function generateStaticParams() {
  try {
    const businesses = await prisma.business.findMany({
      where: { status: "ACTIVE", publishedAt: { not: null } },
      select: { slug: true },
      take: 100,
      orderBy: { publishedAt: "desc" },
    });
    return businesses.map((b) => ({ slug: b.slug }));
  } catch {
    return [];
  }
}

export const revalidate = 3600;
export const dynamicParams = true; // render unknown slugs on-demand, never 404 them early

const SOCIAL_ICONS = {
  instagram: "photo_camera",
  facebook:  "thumb_up",
  twitter:   "tag",
  tiktok:    "music_note",
  youtube:   "play_circle",
  linkedin:  "work",
};

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

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

  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      city:        { select: { id: true, name: true, slug: true } },
      plan:        { select: { slug: true, features: true } },
      photos:      { orderBy: { order: "asc" } },
      categories:  { select: { category: { select: { id: true, name: true, slug: true } } } },
      tags:        { select: { tag: { select: { id: true, name: true, slug: true } } } },
      socialLinks: { orderBy: { order: "asc" } },
      jobs:        { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!business || business.status !== "ACTIVE") notFound();

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
  const isSaved = !!userFavorite;

  const features    = getFeatures(business.plan?.slug ?? "free");
  const showContact = features.SHOW_CONTACT;
  const showWebsite = features.SHOW_WEBSITE;
  const showSocials = features.SHOW_SOCIALS;
  const isPaid      = !!(business.plan?.slug && business.plan.slug !== "free");

  const [heroPhoto, ...galleryPhotos] = business.photos;
  const hoursRows = getBusinessHoursDisplayRows(businessHours);

  const mapsQuery = encodeURIComponent(`${business.address}, ${business.city.name}, TX`);
  const mapsUrl   = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const pageUrl   = `https://txlocalist.com/business/${slug}`;
  const hiringRoles = parseHiringRoles(business.hiringRoles);
  const hiringApplyHref = `/business/${slug}/apply`;

  return (
    <>
      <Navbar />

      <div className={styles.pageWrapper}>

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
              {/* Top-left badges */}
              <div className={styles.heroBadges}>
                <span className={styles.badgeCity}>{business.city.name}, Texas</span>
                {isPaid && (
                  <span className={styles.badgeTier}>{business.plan.slug.toUpperCase()}</span>
                )}
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
                  <SaveButton
                    businessId={business.id}
                    initialSaved={isSaved}
                    initialCount={favoritesCount}
                    isLoggedIn={!!user}
                    size="hero"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className={styles.statsBar}>
            <div className={styles.statsLeft}>
              <div className={styles.avatarStack}>
                <div className={styles.avatarA}>TX</div>
                <div className={styles.avatarB}>L</div>
                <div className={styles.avatarC}>
                  {favoritesCount > 2 ? `+${favoritesCount - 2}` : "+"}
                </div>
              </div>
              <span className={styles.savedLabel}>
                {favoritesCount > 0
                  ? `Saved by ${favoritesCount.toLocaleString()} ${favoritesCount === 1 ? "local" : "locals"}`
                  : "Be the first to save this spot"}
              </span>
            </div>

            {showContact && (business.phone || (showWebsite && business.website)) && (
              <div className={styles.statsRight}>
                {business.phone && (
                  <a href={`tel:${business.phone}`} className={styles.statLink}>
                    <span className="material-icons" style={{ fontSize: "1.1rem" }}>call</span>
                    {business.phone}
                  </a>
                )}
                {business.phone && showWebsite && business.website && (
                  <div className={styles.statDivider} />
                )}
                {showWebsite && business.website && (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.statLink}
                  >
                    <span className="material-icons" style={{ fontSize: "1.1rem" }}>language</span>
                    {getDomain(business.website)}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── PHOTO GALLERY ── */}
        {business.photos.length > 0 && (
          <section className={styles.gallerySection}>
            <div className={styles.galleryHeader}>
              <div>
                <p className={styles.eyebrow}>The Atmosphere</p>
                <h2 className={styles.gallerySectionTitle}>Photo Gallery</h2>
              </div>
              <span className={styles.viewAllBtn}>
                View All {business.photos.length} Photo{business.photos.length !== 1 ? "s" : ""}
              </span>
            </div>
            <PhotoGallery photos={business.photos} businessName={business.name} />
          </section>
        )}

        {/* ── BENTO: About + Hours ── */}
        <section className={styles.bentoSection}>
          <div className={styles.bentoGrid}>

            {/* About card */}
            <div className={styles.aboutCard}>
              <h2 className={styles.aboutTitle}>About {business.name}</h2>
              <p className={styles.aboutDesc}>{business.description}</p>

              {(business.categories.length > 0 || business.tags.length > 0) && (
                <div className={styles.chipRow}>
                  {business.categories.map((bc) => (
                    <Link
                      key={bc.category.id}
                      href={`/categories/${bc.category.slug}`}
                      className={styles.chip}
                    >
                      {bc.category.name}
                    </Link>
                  ))}
                  {business.tags.map((bt) => (
                    <Link
                      key={bt.tag.id}
                      href={`/results?q=${encodeURIComponent(bt.tag.name)}`}
                      className={styles.chipTag}
                    >
                      #{bt.tag.name}
                    </Link>
                  ))}
                </div>
              )}

              {!showContact && (
                <div className={styles.upgradeNudge}>
                  <span
                    className="material-icons"
                    style={{ fontSize: "1.5rem", color: "var(--retro-yellow)", flexShrink: 0 }}
                  >
                    lock
                  </span>
                  <div>
                    <p className={styles.upgradeNudgeTitle}>Contact info hidden</p>
                    <p className={styles.upgradeNudgeDesc}>
                      This business hasn&apos;t upgraded yet. Know the owner?
                    </p>
                  </div>
                  <Link href="/pricing" className={styles.upgradeNudgeBtn}>
                    View Plans →
                  </Link>
                </div>
              )}
            </div>

            {/* Hours + Social card (dark) */}
            <div className={styles.hoursCard}>
              <h3 className={styles.hoursTitle}>Service Hours</h3>
              <div className={styles.hoursList}>
                {hoursRows.map((day) => (
                  <div key={day.dayOfWeek} className={styles.hoursRow}>
                    <span className={styles.hoursDay}>{day.label}</span>
                    <span className={styles.hoursVal}>{day.value}</span>
                  </div>
                ))}
              </div>

              {showSocials && business.socialLinks.length > 0 && (
                <div className={styles.socialRow}>
                  {business.socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialIcon}
                      title={link.platform}
                    >
                      <span className="material-icons" style={{ fontSize: "1.1rem" }}>
                        {SOCIAL_ICONS[link.platform?.toLowerCase()] ?? "link"}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* HIRING */}
        {business.isHiring && (
          <section className={styles.hiringSection}>
            <div className={styles.hiringCard}>
              <div>
                <p className={styles.eyebrow}>Now Hiring</p>
                <h2 className={styles.hiringTitle}>{business.name} is hiring</h2>
                <p className={styles.hiringDescription}>
                  Interested in joining the team? Apply to available roles or reach out directly.
                </p>
                {hiringRoles.length > 0 && (
                  <div className={styles.hiringRolesRow}>
                    {hiringRoles.map((role) => (
                      <span key={role} className={styles.hiringRoleChip}>
                        {role}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Link href={hiringApplyHref} className={styles.hiringApplyBtn}>
                Apply
              </Link>
            </div>
          </section>
        )}

        {/* LOCATION */}
        <section className={styles.locationSection}>
          <div className={styles.locationCard}>

            <div className={styles.locationInfo}>
              <p className={styles.eyebrow}>Visit Us</p>
              <h2 className={styles.locationTitle}>Find the Spot</h2>

              <div className={styles.addressBlock}>
                <span
                  className="material-icons"
                  style={{ fontSize: "1.6rem", color: "var(--retro-red)", flexShrink: 0, marginTop: "0.1rem" }}
                >
                  location_on
                </span>
                <div>
                  <p className={styles.addressText}>
                    {business.address},<br />{business.city.name}, TX
                  </p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.directionsLink}
                  >
                    Get Directions
                  </a>
                </div>
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapsBtn}
              >
                Open in Google Maps
              </a>
            </div>

            <div className={styles.locationMapWrap}>
              <div className={styles.mapPinWrap}>
                <div className={styles.mapPingRing} />
                <div className={styles.mapPin}>
                  <span className="material-icons" style={{ fontSize: "1.75rem" }}>storefront</span>
                </div>
              </div>
            </div>

          </div>
        </section>

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

      </div>

      <Footer />
    </>
  );
}
