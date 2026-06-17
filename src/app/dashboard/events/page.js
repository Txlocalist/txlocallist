import { redirect } from "next/navigation";
import Link from "next/link";

import { deleteEventAction } from "@/app/actions/events";
import { getCurrentSession } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function getEventStatusClass(status) {
  if (status === "PUBLISHED") return "statusACTIVE";
  if (status === "PENDING") return "statusPENDING";
  if (status === "DENIED") return "statusDENIED";
  if (status === "CANCELLED") return "statusARCHIVED";
  return "statusDRAFT";
}

export default async function DashboardEventsPage({ searchParams }) {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const billingState = await getOwnerBillingState(user.id).catch(() => null);
  const canCreateEvents = user.role === "ADMIN" || Boolean(billingState?.hasPaidAccess);

  const params = await searchParams;
  const created = params?.created === "1";

  let events = [];
  let schemaNotice = null;

  try {
    events = await prisma.event.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      include: { business: { select: { name: true } } },
    });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "The events table is not yet in the database. Run npm run db:push to apply the latest schema.";
    } else {
      throw error;
    }
  }

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Live Events</h1>
          <p className={styles.pageSubtitle}>Manage the events connected to your dashboard.</p>
        </div>
        <div className={styles.pageActions}>
          <Link
            href={canCreateEvents ? "/dashboard/events/new" : "/dashboard/billing"}
            className={styles.createButton}
          >
            {canCreateEvents ? "+ Create Event" : "Upgrade Account"}
          </Link>
        </div>
      </div>

      {created && <div className={styles.successBanner}>Your event was submitted for admin review.</div>}

      {schemaNotice && (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Events Unavailable</h2>
            <p className={styles.emptyStateDescription}>{schemaNotice}</p>
          </div>
        </div>
      )}

      {!schemaNotice && events.length === 0 && (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No events yet</h3>
          <p className={styles.emptyStateDescription}>
            Create your first event to send it to the admin review queue.
          </p>
          <Link
            href={canCreateEvents ? "/dashboard/events/new" : "/dashboard/billing"}
            className={styles.emptyStateAction}
          >
            {canCreateEvents ? "Create Event" : "Upgrade Account"}
          </Link>
        </div>
      )}

      {!schemaNotice && events.length > 0 && (
        <div className={styles.businessesTable}>
          <div className={styles.tableHeader}>
            <div className={styles.tableCol} style={{ flex: 2 }}>
              Title
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              City
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Date
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Status
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Actions
            </div>
          </div>
          <div className={styles.tableBody}>
            {events.map((event) => (
              <div key={event.id} className={styles.tableRow}>
                <div className={styles.tableCol} style={{ flex: 2 }} data-label="Title">
                  <div>
                    <p className={styles.businessName}>{event.title}</p>
                    {event.business ? <p className={styles.businessMeta}>{event.business.name}</p> : null}
                  </div>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="City">
                  {event.city}, {event.state}
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Date">
                  {formatDate(event.startDate)}
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Status">
                  <span className={styles[getEventStatusClass(event.status)]}>{event.status}</span>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Actions">
                  <div className={styles.actionButtons}>
                    {event.status === "PUBLISHED" ? (
                      <Link href="/events" className={styles.actionButton} target="_blank">
                        View
                      </Link>
                    ) : null}
                    <form action={deleteEventAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <button type="submit" className={styles.deleteButton}>
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
