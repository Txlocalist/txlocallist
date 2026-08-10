import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { retryEventCheckoutAction } from "@/app/actions/events";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";

import { DashboardLayout } from "../../../../DashboardShell";
import styles from "../../../../dashboard.module.css";

const EVENT_POST_PRICE = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

export const metadata = {
  title: "Event Checkout Closed | TX Localist",
};

export default async function EventCheckoutCancelPage({ params }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(`/dashboard/events/${id}/checkout/cancel`)}`);

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true, status: true },
  });
  if (!event || event.creatorId !== session.user.id) notFound();
  const eventPostingEnabled = isEventPostingEnabled();
  const checkoutMessage = event.status !== "DRAFT"
    ? "Stripe has already updated this event. Return to My Events for its current status."
    : eventPostingEnabled
      ? `${event.title} stays as a private draft unless Stripe confirms payment. You can safely retry Checkout.`
      : `${event.title} remains saved as a private draft. One-time Checkout is currently paused.`;

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyStateTitle}>Checkout Closed</h1>
          <p className={styles.emptyStateDescription}>
            {checkoutMessage}
          </p>
          {event.status === "DRAFT" && eventPostingEnabled ? (
            <form action={retryEventCheckoutAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className={styles.emptyStateAction}>
                Retry {EVENT_POST_PRICE} Checkout
              </button>
            </form>
          ) : null}
          <Link href="/dashboard/events" className={styles.actionButton}>Back to My Events</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
