import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { getOwnerBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import {
  EVENT_MAX_CALENDAR_DAYS,
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";

import { DashboardLayout } from "../../DashboardShell";
import styles from "../../dashboard.module.css";
import { CreateEventForm } from "./CreateEventForm";

export const metadata = {
  title: "Post an Event | TX Localist",
};

export default async function NewEventPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login?next=/dashboard/events/new");

  const user = session.user;
  let billingState = null;
  let billingUnavailable = false;

  if (user.role !== "ADMIN") {
    try {
      billingState = await getOwnerBillingState(user.id);
      billingUnavailable = !billingState;
    } catch (error) {
      console.error("[events] billing entitlement lookup failed:", error);
      billingUnavailable = true;
    }
  }

  const oneTimePostingEnabled = isEventPostingEnabled();
  const eventPostPrice = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);
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
      schemaNotice = "The event posting database update has not been applied yet.";
    } else {
      throw error;
    }
  }

  return (
    <DashboardLayout activeTab="events-create">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Post an Event</h1>
          <p className={styles.pageSubtitle}>
            One price covers one continuous event lasting up to {EVENT_MAX_CALENDAR_DAYS} calendar days.
          </p>
        </div>
      </div>

      {schemaNotice ||
      billingUnavailable ||
      (!oneTimePostingEnabled &&
        !(billingState?.hasPaidAccess && businesses.length > 0) &&
        user.role !== "ADMIN") ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Posting Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice ??
                (billingUnavailable
                  ? "We could not verify your membership right now. Please try again before posting."
                  : "One-time event posting is being configured. Please check back soon.")}
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <CreateEventForm
            businesses={businesses}
            hasMembership={Boolean(billingState?.hasPaidAccess)}
            isAdmin={user.role === "ADMIN"}
            oneTimePostingEnabled={oneTimePostingEnabled}
            eventPostPrice={eventPostPrice}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
