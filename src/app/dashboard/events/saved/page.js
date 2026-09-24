import ResultsSort from "@/components/ResultsSort/ResultsSort";
import { resultOrderBy } from "@/lib/results-sort";
import { getPublicEventAccessWhere } from "@/lib/listing-visibility";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLayout } from "../../DashboardShell";
import styles from "../../dashboard.module.css";
import { getCurrentSession } from "@/lib/auth/session";
import { formatEventDateRange, formatEventTime, isEventPast } from "@/lib/event-dates";
import { getNextEventOccurrence, isRecurringEvent } from "@/lib/event-recurrence";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export default async function SavedEventsPage({ searchParams }) {
  const params = await searchParams;
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
          event: { ...getPublicEventAccessWhere() },
        },
        orderBy: params?.sort === "name-asc" || params?.sort === "name-desc" ? [{ event: { sortName: params.sort === "name-asc" ? "asc" : "desc" } }, { id: "asc" }] : resultOrderBy(params?.sort),
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
              endDate: true,
              recurrence: true,
              recurrenceUntil: true,
              timezone: true,
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
          <h1 className={styles.pageTitle}>Saved Happenings</h1>
          <p className={styles.pageSubtitle}>
            Keep track of happenings you want to come back to.
          </p>
        </div>
      </div>

      <ResultsSort saved />
      {savedEvents.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.listContainer}>
            {savedEvents.map(({ id, event }) => {
              if (isRecurringEvent(event)) event = { ...event, ...(getNextEventOccurrence(event) || {}) };
              const cityLabel = [event.city, event.state].filter(Boolean).join(", ");

              return (
                <div key={id} className={styles.listItem}>
                  <div>
                    <Link href={`/events/${event.id}`} className={styles.listItemTitle}>
                      {event.title}
                    </Link>
                    <p className={styles.listItemMeta}>
                      {formatEventDateRange(event.startDate, event.endDate, event.timezone)} at{" "}
                      {formatEventTime(event.startDate, event.timezone)}
                      {event.addressName ? `, ${event.addressName}` : ""}
                      {cityLabel ? `, ${cityLabel}` : ""}
                      {isEventPast(event) ? " (Past happening)" : ""}
                    </p>
                  </div>
                  <div className={styles.listItemAction}>
                    <Link
                      href={`/events/${event.id}`}
                      className={`${styles.statusBadge} ${styles.statusActive}`}
                    >
                      View Happening
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
            <h2 className={styles.emptyStateTitle}>No saved happenings yet</h2>
            <p className={styles.emptyStateDescription}>
              Save a happening from its detail page and it will appear here.
            </p>
            <Link href="/events" className={styles.emptyStateAction}>
              Explore Happenings
            </Link>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
