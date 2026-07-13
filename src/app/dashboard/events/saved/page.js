import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLayout } from "../../DashboardShell";
import styles from "../../dashboard.module.css";
import { getCurrentSession } from "@/lib/auth/session";
import { formatEventTime, formatLongEventDate } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export default async function SavedEventsPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  let savedEvents = [];

  if (prisma.eventFavorite) {
    try {
      savedEvents = await prisma.eventFavorite.findMany({
        where: {
          userId: session.user.id,
          event: { status: "PUBLISHED" },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          event: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true,
              addressName: true,
              startDate: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isMissingPrismaTableError(error)) {
        throw error;
      }
    }
  }

  return (
    <DashboardLayout activeTab="events-saved">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Saved Events</h1>
          <p className={styles.pageSubtitle}>
            Keep track of events you want to come back to.
          </p>
        </div>
      </div>

      {savedEvents.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.listContainer}>
            {savedEvents.map(({ id, event }) => {
              const cityLabel = [event.city, event.state].filter(Boolean).join(", ");

              return (
                <div key={id} className={styles.listItem}>
                  <div>
                    <Link href={`/events/${event.id}`} className={styles.listItemTitle}>
                      {event.title}
                    </Link>
                    <p className={styles.listItemMeta}>
                      {formatLongEventDate(event.startDate)} at {formatEventTime(event.startDate)}
                      {event.addressName ? ` · ${event.addressName}` : ""}
                      {cityLabel ? ` · ${cityLabel}` : ""}
                    </p>
                  </div>
                  <div className={styles.listItemAction}>
                    <Link
                      href={`/events/${event.id}`}
                      className={`${styles.statusBadge} ${styles.statusActive}`}
                    >
                      View Event
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>No saved events yet</h2>
            <p className={styles.emptyStateDescription}>
              Save an event from its detail page and it will appear here.
            </p>
            <Link href="/events" className={styles.emptyStateAction}>
              Explore Events
            </Link>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
