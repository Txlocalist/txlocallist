import { redirect } from "next/navigation";
import { DashboardLayout } from "../../../DashboardShell";
import { EditBusinessForm } from "./EditBusinessForm";
import styles from "../../../dashboard.module.css";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { isMissingPrismaTableError, phase3SchemaMessage } from "@/lib/prisma-errors";

/**
 * Edit business page.
 */
export default async function EditBusinessPage({ params }) {
  const session = await getCurrentSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;
  const billingState = await getOwnerBillingState(user.id).catch(() => null);

  if (user.role !== "ADMIN" && !billingState?.hasPaidAccess) {
    redirect("/dashboard/billing");
  }

  // Next.js 16: params is a Promise — must be awaited
  const { id } = await params;

  let business;
  let businessHours = [];
  let cities = [];
  let tags = [];
  let schemaNotice = null;

  try {
    business = await prisma.business.findUnique({
      where: { id },
      include: {
        city: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    if (business) {
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
    }
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    schemaNotice = phase3SchemaMessage;
  }

  if (schemaNotice) {
    return (
      <DashboardLayout activeTab="businesses-live">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Edit Listing</h1>
            <p className={styles.pageSubtitle}>Listing data is waiting on the Phase 3 schema.</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Edit Form Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice} Apply the database update and reload this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!business) {
    return <div>Business not found</div>;
  }

  // Check ownership
  if (business.ownerId !== user.id && user.role !== "ADMIN") {
    redirect("/dashboard/businesses");
  }

  try {
    [cities, tags] = await Promise.all([
      prisma.city.findMany({ orderBy: { name: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);
  } catch (error) {
    if (!isMissingPrismaTableError(error)) {
      throw error;
    }

    return (
      <DashboardLayout activeTab="businesses-live">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Edit Listing</h1>
            <p className={styles.pageSubtitle}>Listing data loaded, but reference data is still missing.</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Reference Data Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {phase3SchemaMessage} Finish the schema update so cities and tags can load.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeTab="businesses-live">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Edit Listing</h1>
          <p className={styles.pageSubtitle}>
            Update {business.name}
          </p>
        </div>
      </div>

      <EditBusinessForm
        business={{ ...business, hours: businessHours }}
        cities={cities}
        tags={tags}
      />
    </DashboardLayout>
  );
}
