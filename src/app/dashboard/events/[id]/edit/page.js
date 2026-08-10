import { formatInTimeZone } from "date-fns-tz";
import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  fromEventCategoryTagName,
  isEventCategoryTagName,
} from "@/lib/event-categories.mjs";
import { prisma } from "@/lib/prisma";
import {
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";

import { DashboardLayout } from "../../../DashboardShell";
import styles from "../../../dashboard.module.css";
import { CreateEventForm } from "../../new/CreateEventForm";

export const metadata = {
  title: "Edit Event | TX Localist",
};

export default async function EditEventPage({ params }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(`/dashboard/events/${id}/edit`)}`);

  const [event, businesses] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: { tags: { select: { name: true } } },
    }),
    prisma.business.findMany({
      where: { ownerId: session.user.id, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!event || (event.creatorId !== session.user.id && session.user.role !== "ADMIN")) {
    notFound();
  }

  const category = event.tags
    .map((tag) => fromEventCategoryTagName(tag.name))
    .find(Boolean) ?? "Other";
  const optionalTags = event.tags
    .filter((tag) => !isEventCategoryTagName(tag.name))
    .map((tag) => tag.name)
    .join(", ");
  const timezone = event.timezone || "America/Chicago";
  const initialEvent = {
    id: event.id,
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    category,
    addressName: event.addressName,
    address: event.address,
    city: event.city,
    state: event.state,
    zipCode: event.zipCode,
    businessId: event.businessId,
    timezone,
    eventUrl: event.eventUrl,
    startDate: event.startDate
      ? formatInTimeZone(event.startDate, timezone, "yyyy-MM-dd'T'HH:mm")
      : "",
    endDate: event.endDate
      ? formatInTimeZone(event.endDate, timezone, "yyyy-MM-dd'T'HH:mm")
      : "",
    tags: optionalTags,
  };

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Edit Event</h1>
          <p className={styles.pageSubtitle}>
            Material changes to a published event return it to admin review.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <CreateEventForm
          businesses={businesses}
          initialEvent={initialEvent}
          mode="edit"
          oneTimePostingEnabled={isEventPostingEnabled()}
          eventPostPrice={formatWholeDollarPrice(EVENT_POST_PRICE_CENTS)}
        />
      </div>
    </DashboardLayout>
  );
}
