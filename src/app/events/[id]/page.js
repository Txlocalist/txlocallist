import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer, Navbar } from "@/components";
import { getCurrentUser } from "@/lib/auth/session";
import { getBlobImageUrl } from "@/lib/blob";
import { formatEventTime, formatLongEventDate, getEventById } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

import EventActions from "./EventActions";
import EventHeroImage from "./EventHeroImage";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const event = await getEventById(resolvedParams.id);

  if (!event) {
    return {
      title: "Event Not Found | Texas Localist",
    };
  }

  const imageUrl = event.imageUrl ? getBlobImageUrl(event.imageUrl) : null;

  return {
    title: `${event.title} | Texas Localist`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      type: "website",
      ...(imageUrl ? { images: [{ url: imageUrl, alt: event.title }] } : {}),
    },
  };
}

export default async function EventDetailPage({ params }) {
  const resolvedParams = await params;
  const [event, user] = await Promise.all([
    getEventById(resolvedParams.id),
    getCurrentUser().catch(() => null),
  ]);

  if (!event) {
    notFound();
  }

  let favoritesCount = 0;
  let isSaved = false;

  try {
    if (!prisma.eventFavorite) {
      throw Object.assign(new Error("EventFavorite model is not loaded yet."), { code: "P2021" });
    }

    const [count, userFavorite] = await Promise.all([
      prisma.eventFavorite.count({ where: { eventId: event.id } }),
      user
        ? prisma.eventFavorite.findUnique({
            where: { userId_eventId: { userId: user.id, eventId: event.id } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    favoritesCount = count;
    isSaved = Boolean(userFavorite);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }
  }

  const imageUrl = event.imageUrl ? getBlobImageUrl(event.imageUrl) : "";
  const mapQuery = Array.from(
    new Set([event.addressName, event.address, event.cityLabel].filter(Boolean))
  ).join(", ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const actionEvent = {
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    venue: event.venue,
    address: event.address,
    cityLabel: event.cityLabel,
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.shell}>
        <Link href="/events/results" className={styles.backLink}>
          <span className="material-icons" aria-hidden="true">west</span>
          Back to Events
        </Link>

        <section className={styles.hero} aria-labelledby="event-title">
          <div className={styles.heroContent}>
            <div className={styles.labelRow}>
              <span className={styles.typePill}>{event.type}</span>
              <span className={styles.cityLabel}>{event.cityLabel}</span>
            </div>

            <h1 id="event-title" className={styles.title}>{event.title}</h1>

            <div className={styles.starDivider} aria-hidden="true">
              <span />
              <i>★</i>
              <span />
            </div>

            <EventActions
              eventId={event.id}
              initialSaved={isSaved}
              initialCount={favoritesCount}
              isLoggedIn={Boolean(user)}
              event={actionEvent}
            />
          </div>

          <div className={styles.heroImage}>
            <EventHeroImage
              src={imageUrl}
              alt={`${event.title} event photo`}
              type={event.type}
              dateLabel={formatLongEventDate(event.startDate)}
              timeLabel={formatEventTime(event.startDate)}
              cityLabel={event.cityLabel}
            />
          </div>
        </section>

        <section className={styles.detailsGrid} aria-label="Event details">
          <article className={styles.aboutCard}>
            <h2>About This Event</h2>
            <div className={styles.cardRule} />
            <p>{event.description}</p>
            {event.tags.length > 0 ? (
              <div className={styles.tagRow}>
                {event.tags.slice(0, 5).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </article>

          <div className={styles.detailStack}>
            <article className={styles.infoCard}>
              <div className={styles.iconCircle}>
                <span className="material-icons" aria-hidden="true">calendar_month</span>
              </div>
              <div>
                <h2>Date &amp; Time</h2>
                <p className={styles.infoPrimary}>{formatLongEventDate(event.startDate)}</p>
                <p className={styles.infoAccent}>{formatEventTime(event.startDate)}</p>
              </div>
            </article>

            <article className={styles.infoCard}>
              <div className={styles.iconCircle}>
                <span className="material-icons" aria-hidden="true">location_on</span>
              </div>
              <div>
                <h2>Location</h2>
                <p className={styles.infoPrimary}>{event.addressName || event.venue}</p>
                {event.address && event.address !== event.addressName ? (
                  <p className={styles.addressLine}>{event.address}</p>
                ) : null}
                <p className={styles.infoAccent}>{event.cityLabel}</p>
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={styles.mapButton}>
                  Open Map
                </a>
              </div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
