import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardLayout } from "../../DashboardShell";
import styles from "../../dashboard.module.css";
import { getCurrentSession } from "@/lib/auth/session";

export default async function SavedEventsPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
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

      <div className={styles.card}>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>No saved events yet</h2>
          <p className={styles.emptyStateDescription}>
            Event saving is not wired into the dashboard yet, so this section is ready for the
            saved-events flow when that feature is added.
          </p>
          <Link href="/events" className={styles.emptyStateAction}>
            Explore Events
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
