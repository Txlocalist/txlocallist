import Link from "next/link";

import { getBlobImageUrl } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import styles from "./events.module.css";

function formatDate(val) {
  if (!val) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(val));
}

/**
 * Server component — renders upcoming events near the searched city.
 * Silently returns null if the events table does not yet exist.
 */
export async function EventsSection({ city = "" }) {
  let events = [];

  try {
    const where = { status: "PUBLISHED" };
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    events = await prisma.event.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        tags: { select: { name: true } },
        business: { select: { name: true, slug: true } },
      },
    });
  } catch (err) {
    // If the table doesn't exist yet, silently hide the section
    if (isMissingPrismaTableError(err)) return null;
    throw err;
  }

  if (events.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {city ? `Events near ${city}` : "Local Events"}
          </h2>
          <p className={styles.subtitle}>Happenings in your area</p>
        </div>
        <Link href="/events" className={styles.seeAll}>
          See all events →
        </Link>
      </div>

      <div className={styles.grid}>
        {events.map((event) => (
          <article key={event.id} className={styles.card}>
            {event.imageUrl && (
              <div
                className={styles.cardImage}
                style={{ backgroundImage: `url("${getBlobImageUrl(event.imageUrl)}")` }}
              />
            )}
            <div className={styles.cardBody}>
              {event.startDate && (
                <p className={styles.cardDate}>{formatDate(event.startDate)}</p>
              )}
              <h3 className={styles.cardTitle}>{event.title}</h3>
              <p className={styles.cardLocation}>
                {event.addressName || event.address}
                {event.city ? `, ${event.city}` : ""}
              </p>
              {event.business && (
                <p className={styles.cardBusiness}>
                  <Link href={`/business/${event.business.slug}`}>
                    {event.business.name}
                  </Link>
                </p>
              )}
              {event.tags.length > 0 && (
                <div className={styles.tagRow}>
                  {event.tags.slice(0, 3).map((tag) => (
                    <span key={tag.name} className={styles.tag}>{tag.name}</span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className={styles.footer}>
        <Link href="/events" className={styles.footerLink}>
          Browse all local events →
        </Link>
        <Link href="/dashboard/events/new" className={styles.footerLinkSecondary}>
          Post an event
        </Link>
      </div>
    </section>
  );
}
