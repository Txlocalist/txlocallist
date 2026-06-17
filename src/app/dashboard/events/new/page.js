import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardLayout } from "../../DashboardShell";
import { CreateEventForm } from "./CreateEventForm";
import styles from "../../dashboard.module.css";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";

export default async function NewEventPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const billingState = await getOwnerBillingState(user.id).catch(() => null);
  const canCreateEvents = user.role === "ADMIN" || Boolean(billingState?.hasPaidAccess);

  if (!canCreateEvents) {
    return (
      <DashboardLayout activeTab="events-create">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Create Event</h1>
            <p className={styles.pageSubtitle}>Upgrade your account before posting events.</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Upgrade Required</h2>
            <p className={styles.emptyStateDescription}>
              Event posting is part of the $20 paid creator account. Upgrade in billing first, then
              attach events to your business from this dashboard.
            </p>
            <Link href="/dashboard/billing" className={styles.emptyStateAction}>
              Upgrade Account
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  let businesses = [];
  let schemaNotice = null;

  try {
    businesses = await prisma.business.findMany({
      where: { ownerId: user.id, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "The database schema is not ready. Run npm run db:push and reload.";
    } else {
      throw error;
    }
  }

  return (
    <DashboardLayout activeTab="events-create">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Create Event</h1>
          <p className={styles.pageSubtitle}>Post a local event to the directory</p>
        </div>
      </div>

      {schemaNotice ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Schema Not Ready</h2>
            <p className={styles.emptyStateDescription}>{schemaNotice}</p>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          {businesses.length > 0 ? (
            <CreateEventForm businesses={businesses} />
          ) : (
            <div className={styles.emptyState}>
              <h2 className={styles.emptyStateTitle}>Create A Business First</h2>
              <p className={styles.emptyStateDescription}>
                Events must be linked to one of your active business listings before they can be published.
              </p>
              <Link href="/dashboard/businesses/new" className={styles.emptyStateAction}>
                Create Listing
              </Link>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
