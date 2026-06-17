import { redirect } from "next/navigation";
import { DashboardLayout } from "../../DashboardShell";
import { CreateBusinessForm } from "./CreateBusinessForm";
import styles from "../../dashboard.module.css";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

/**
 * New business creation page.
 */
export default async function NewBusinessPage() {
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;

  let billingState = null;

  try {
    billingState = await getOwnerBillingState(user.id);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }
  }

  if (user.role !== "ADMIN" && !billingState?.hasPaidAccess) {
    return (
      <DashboardLayout activeTab="businesses-create">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Create a New Listing</h1>
            <p className={styles.pageSubtitle}>
              Listing creation unlocks after you start the paid account plan.
            </p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Upgrade Required</h2>
            <p className={styles.emptyStateDescription}>
              This account is currently on the free tier. Upgrade in billing first, then come back
              here to create your listing.
            </p>
            <a href="/dashboard/billing" className={styles.emptyStateAction}>
              Upgrade Account
            </a>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  let cities = [];
  let tags = [];
  let schemaNotice = null;

  try {
    [cities, tags] = await Promise.all([
      prisma.city.findMany({ orderBy: { name: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    schemaNotice = phase3SchemaMessage;
  }

  return (
    <DashboardLayout activeTab="businesses-create">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Create a New Listing</h1>
          <p className={styles.pageSubtitle}>
            Add your business to the TX Localist directory
          </p>
        </div>
      </div>

      {schemaNotice ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Form Not Ready Yet</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Once the database is updated, the city and tag options will appear here.
            </p>
          </div>
        </div>
      ) : (
        <CreateBusinessForm cities={cities} tags={tags} />
      )}
    </DashboardLayout>
  );
}
