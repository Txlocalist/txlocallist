import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession } from "@/lib/auth/session";
import { getAccountAccess, isStaffRole } from "@/lib/account-access";
import { prisma } from "@/lib/prisma";
import { getSelectableCities } from "@/lib/cities.server";
import { getEventCategoryOptions, getEventTagOptions } from "@/lib/categories.server";
import { getEventBusinessProfileNotice } from "@/lib/event-business-profile";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import { EVENT_MAX_CALENDAR_DAYS } from "@/lib/pricing";

import { DashboardLayout } from "../../DashboardShell";
import styles from "../../dashboard.module.css";
import { CreateEventForm } from "./CreateEventForm";

export const metadata = {
  title: "Post a Happening | TX Localist",
};

export default async function NewEventPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login?next=/dashboard/events/new");

  const user = session.user;
  const isStaff = isStaffRole(user.role);
  let billingState = null;
  let billingUnavailable = false;

  try {
    billingState = await getAccountAccess(user.id);
    billingUnavailable = !billingState && !isStaff;
  } catch (error) {
    console.error("[events] billing entitlement lookup failed:", error);
    billingUnavailable = !isStaff;
  }

  let businesses = [];
  let hasBusinessProfile = false;
  let cities = [];
  let categories = [];
  let tagOptions = [];
  let schemaNotice = null;

  try {
    [businesses, cities, categories, tagOptions] = await Promise.all([prisma.business.findMany({
      where: { ownerId: user.id, deletedAt: null },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }), getSelectableCities(), getEventCategoryOptions(), getEventTagOptions()]);
    hasBusinessProfile = businesses.length > 0;
    businesses = businesses.filter((business) => business.status === "ACTIVE");
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "Happening posting is unavailable until the database update is applied.";
    } else {
      throw error;
    }
  }

  const needsBusinessProfile = !isStaff && businesses.length === 0 && (
    billingState?.hasMembershipAccess
  );
  const profileNotice = getEventBusinessProfileNotice(hasBusinessProfile);

  return (
    <DashboardLayout activeTab="events-create">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Post a Happening</h1>
          <p className={styles.pageSubtitle}>
            Post a single happening lasting up to {EVENT_MAX_CALENDAR_DAYS} calendar days, or use membership to repeat a happening every week.
          </p>
        </div>
      </div>

      {schemaNotice ||
      billingUnavailable ||
      (!billingState?.hasMembershipAccess && !isStaff) ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>Posting Unavailable</h2>
            <p className={styles.emptyStateDescription}>
              {schemaNotice ??
                (billingUnavailable
                  ? "We could not verify your membership right now. Please try again before posting."
                  : "An active business membership is required to add events to the calendar.")}
            </p>
            {!schemaNotice && !billingUnavailable ? (
              <Link href="/dashboard/billing" className={styles.emptyStateAction}>
                Advertise Your Business
              </Link>
            ) : null}
          </div>
        </div>
      ) : needsBusinessProfile ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>{profileNotice.title}</h2>
            <p className={styles.emptyStateDescription}>{profileNotice.description}</p>
            <Link href={profileNotice.href} className={styles.emptyStateAction}>
              {profileNotice.label}
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <CreateEventForm
            businesses={businesses}
            cities={cities}
            categories={categories}
            tagOptions={tagOptions}
            hasMembership={Boolean(billingState?.hasMembershipAccess)}
            isStaff={isStaff}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
