import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { syncEventPaymentFromCheckoutSession } from "@/lib/event-payments";
import { prisma } from "@/lib/prisma";

import { DashboardLayout } from "../../../../DashboardShell";
import styles from "../../../../dashboard.module.css";

export const metadata = {
  title: "Event Payment | TX Localist",
};

export default async function EventCheckoutSuccessPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getCurrentSession();
  if (!session?.user) redirect(`/login?next=${encodeURIComponent(`/dashboard/events/${id}/checkout/success`)}`);

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true, status: true },
  });
  if (!event || event.creatorId !== session.user.id) notFound();

  let confirmed = false;
  if (typeof query?.session_id === "string") {
    try {
      confirmed = await syncEventPaymentFromCheckoutSession(
        query.session_id,
        session.user.id,
        id,
      );
    } catch (error) {
      console.error("[events] success-page payment sync failed:", error);
    }
  }

  const payment = await prisma.eventPayment.findFirst({
    where: { eventId: id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  const paid = confirmed || payment?.status === "PAID";
  const refunded = payment?.status === "REFUNDED";
  const refundPending = payment?.status === "REFUND_PENDING";
  const refundFailed = payment?.status === "REFUND_FAILED";
  const reviewRequired = payment?.status === "REVIEW_REQUIRED";
  const cancelledPaid = paid && event.status === "CANCELLED";

  const heading = refunded
    ? "Payment Refunded"
    : refundPending
      ? "Refund Started"
      : refundFailed
        ? "Refund Needs Attention"
        : reviewRequired
          ? "Payment Needs Admin Review"
        : cancelledPaid
          ? "Event Canceled"
        : paid
          ? "Payment Confirmed"
          : "Payment Is Verifying";
  const description = refunded
    ? `An administrator issued a full refund for ${event.title}.`
    : refundPending
      ? `Stripe is processing the full refund approved by an administrator for ${event.title}.`
      : refundFailed
        ? "The administrator-approved refund needs support attention. Do not submit another payment."
        : reviewRequired
          ? "The payment was recorded, but an administrator must review it before the event can continue. No refund will be issued automatically."
        : cancelledPaid
          ? "Stripe confirmed payment before cancellation completed. The event remains canceled, and no automatic refund was issued."
        : paid
          ? `${event.title} is now in the admin review queue.`
          : "Stripe has not confirmed the payment yet. The signed webhook will update this event when payment settles.";

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <h1 className={styles.emptyStateTitle}>{heading}</h1>
          <p className={styles.emptyStateDescription}>{description}</p>
          <Link href="/dashboard/events" className={styles.emptyStateAction}>View My Events</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
