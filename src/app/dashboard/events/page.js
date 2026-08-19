import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteEventAction,
  resubmitEventAction,
  retryEventCheckoutAction,
} from "@/app/actions/events";
import { getCurrentSession } from "@/lib/auth/session";
import { formatEventDateRange, isEventPast } from "@/lib/event-dates";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import {
  EVENT_POST_PRICE_CENTS,
  formatWholeDollarPrice,
  isEventPostingEnabled,
} from "@/lib/pricing";

import { DashboardLayout } from "../DashboardShell";
import styles from "../dashboard.module.css";
import CancelEventButton from "./CancelEventButton";

const EVENT_POST_PRICE = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

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
  const params = await searchParams;
  const created = params?.created === "1";
  const updated = params?.updated === "1";
  const canceled = params?.canceled === "1";
  const cancellationBlocked = params?.cancel === "blocked";
  const paymentUnavailable = params?.payment === "unavailable";
  const resubmitted = params?.resubmitted === "1";
  const resubmitError = params?.resubmit;
  const eventPostingEnabled = isEventPostingEnabled();

  let events = [];
  let schemaNotice = null;

  try {
    events = await prisma.event.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        business: { select: { name: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          select: { status: true, failureReason: true },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            decision: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "The event posting database migration has not been applied yet.";
    } else {
      throw error;
    }
  }

  return (
    <DashboardLayout activeTab="events-live">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Events</h1>
          <p className={styles.pageSubtitle}>Manage the events connected to your dashboard.</p>
        </div>
        <div className={styles.pageActions}>
          <Link
            href="/dashboard/events/new"
            className={styles.createButton}
          >
            + Post Event
          </Link>
        </div>
      </div>

      {created && <div className={styles.successBanner}>Your event was submitted for admin review.</div>}
      {updated && <div className={styles.successBanner}>Your event changes were saved.</div>}
      {resubmitted && <div className={styles.successBanner}>Your corrected event was resubmitted for admin review.</div>}
      {canceled && <div className={styles.successBanner}>Your event was canceled. No automatic refund was issued.</div>}
      {cancellationBlocked ? (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          Cancellation is waiting for Stripe to finish the current payment. Try again after the payment status updates.
        </div>
      ) : null}
      {paymentUnavailable ? (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          Stripe Checkout could not start. Please try again.
        </div>
      ) : null}
      {resubmitError ? (
        <div className={`${styles.noticeBanner} ${styles.noticeError}`}>
          {resubmitError === "membership"
            ? "An active membership and linked active business are required to resubmit this event."
            : resubmitError === "payment"
              ? "The original event payment or purchased date range could not be verified. Contact support for help."
              : "This event could not be resubmitted. Reload the page and try again."}
        </div>
      ) : null}

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
            href="/dashboard/events/new"
            className={styles.emptyStateAction}
          >
            Post Event
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
            {events.map((event) => {
              const latestPayment = event.payments[0];
              const latestReview = event.reviews[0];
              const changesRequested = Boolean(
                event.status === "DRAFT" && latestReview?.decision === "DENIED",
              );
              const hasPaidPayment = event.payments.some(
                (payment) => payment.status === "PAID",
              );
              const paymentNeedsAdminReview = event.payments.some(
                (payment) => payment.status === "REVIEW_REQUIRED",
              );
              const hasUnresolvedRefund = event.payments.some((payment) =>
                ["REFUND_PENDING", "REFUND_FAILED"].includes(payment.status)
              );
              const paymentIsStillProcessing = event.payments.some((payment) =>
                payment.status === "PROCESSING" &&
                payment.failureReason === "Stripe is still processing this event payment."
              );

              return (
              <div key={event.id} className={styles.tableRow}>
                <div className={styles.tableCol} style={{ flex: 2 }} data-label="Title">
                  <div>
                    <p className={styles.businessName}>{event.title}</p>
                    {event.business ? <p className={styles.businessMeta}>{event.business.name}</p> : null}
                    <p className={styles.businessMeta}>
                      {event.postingMethod === "ONE_TIME" ? "One-time post" : "Membership post"}
                      {latestPayment?.status ? ` | Payment: ${latestPayment.status}` : ""}
                    </p>
                    {hasUnresolvedRefund ? (
                      <p className={styles.businessMeta}>
                        Payment support is resolving a refund. Do not pay again.
                      </p>
                    ) : null}
                    {paymentIsStillProcessing ? (
                      <p className={styles.businessMeta}>
                        Stripe is still processing this payment. Do not pay again.
                      </p>
                    ) : null}
                    {paymentNeedsAdminReview ? (
                      <p className={styles.businessMeta}>
                        This payment needs administrator review. No refund will be issued automatically.
                      </p>
                    ) : null}
                    {changesRequested && latestReview.comment ? (
                      <div className={`${styles.noticeBanner} ${styles.noticeWarning}`}>
                        <h3 className={styles.noticeTitle}>Corrections requested</h3>
                        <p className={styles.noticeDescription}>{latestReview.comment}</p>
                      </div>
                    ) : null}
                    {event.reviews.length > 0 ? (
                      <details className={styles.reviewTimeline}>
                        <summary className={styles.actionButton}>Review history</summary>
                        <ol className={styles.reviewTimelineList}>
                          {event.reviews.map((review) => (
                            <li key={review.id} className={styles.reviewTimelineItem}>
                              <strong>{review.decision}</strong>
                              {` · ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(review.createdAt)}`}
                              {review.comment ? <p>{review.comment}</p> : null}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                    {event.postingMethod === "ONE_TIME" && hasPaidPayment ? (
                      <p className={styles.businessMeta}>
                        Need a refund? Contact <Link href="/contact">support</Link>. Refunds require admin approval.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="City">
                  {event.city}, {event.state}
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Date">
                  {formatEventDateRange(
                    event.startDate,
                    event.endDate,
                    event.timezone,
                    { compact: true },
                  )}
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Status">
                  <span className={styles[getEventStatusClass(event.status)]}>
                    {changesRequested ? "CHANGES REQUESTED" : event.status}
                  </span>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Actions">
                  <div className={styles.actionButtons}>
                    {event.status === "PUBLISHED" ? (
                      <Link href={`/events/${event.id}`} className={styles.actionButton} target="_blank">
                        View
                      </Link>
                    ) : null}
                    {!(["CANCELLED", "DENIED"].includes(event.status)) && !isEventPast(event) ? (
                      <Link href={`/dashboard/events/${event.id}/edit`} className={styles.actionButton}>
                        Edit
                      </Link>
                    ) : null}
                    {event.postingMethod === "ONE_TIME" &&
                    event.status === "DRAFT" &&
                    event.endDate &&
                    eventPostingEnabled &&
                    !hasPaidPayment &&
                    !paymentNeedsAdminReview &&
                    !hasUnresolvedRefund &&
                    !paymentIsStillProcessing &&
                    !isEventPast(event) ? (
                      <form action={retryEventCheckoutAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className={styles.actionButton}>
                          Pay {EVENT_POST_PRICE}
                        </button>
                      </form>
                    ) : null}
                    {changesRequested && !isEventPast(event) ? (
                      <form action={resubmitEventAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className={styles.publishButton}>
                          Resubmit for Review
                        </button>
                      </form>
                    ) : null}
                    {!(["CANCELLED", "DENIED"].includes(event.status)) && !isEventPast(event) ? (
                      <form action={deleteEventAction}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <CancelEventButton className={styles.deleteButton} />
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
