import Link from "next/link";

import {
  issueEventPaymentRefundAction,
  restoreEventAfterDisputeAction,
  updatePostModerationStatusAction,
} from "@/app/actions/admin";
import { AdminShell } from "@/app/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { getBlobImageUrl } from "@/lib/blob";
import { formatEventDateRange, formatEventTime } from "@/lib/event-dates";
import {
  isFavorableEventDisputeStatus,
  isTerminalEventDisputeStatus,
} from "@/lib/event-disputes";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import styles from "@/app/dashboard/dashboard.module.css";

const BUSINESS_HISTORY_STATUSES = ["DENIED", "ACTIVE"];
const EVENT_HISTORY_STATUSES = ["DENIED", "PUBLISHED", "CANCELLED"];
const PAGE_SIZE = 100;

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(amountCents, currency = "usd") {
  if (!Number.isInteger(amountCents)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function getOwnerLabel(owner) {
  if (!owner) return "-";
  return owner.name?.trim() || owner.email || "-";
}

function getModerationValue(status, entityType) {
  if (status === "DENIED") return "denied";
  if (entityType === "business") return status === "ACTIVE" ? "approved" : "pending";
  return status === "PUBLISHED" ? "approved" : "pending";
}

function getModerationBadgeClass(status) {
  if (status === "DENIED") return styles.statusDENIED;
  if (status === "ACTIVE" || status === "PUBLISHED") return styles.statusACTIVE;
  return styles.statusPENDING;
}

function ModerationForm({ entityId, entityType, currentStatus, canApprove = true }) {
  return (
    <form action={updatePostModerationStatusAction} className={styles.moderationForm}>
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="entityType" value={entityType} />
      <select
        name="status"
        defaultValue={getModerationValue(currentStatus, entityType)}
        className={styles.moderationSelect}
      >
        <option value="pending">Pending</option>
        {canApprove ? <option value="approved">Approved</option> : null}
        <option value="denied">Denied</option>
      </select>
      <button type="submit" className={styles.actionButtonSecondary}>
        Save
      </button>
    </form>
  );
}

function EventModerationForm({ eventId, canApprove = true }) {
  const commentId = `denial-comment-${eventId}`;

  return (
    <div className={styles.eventModerationForms}>
      {canApprove ? (
        <form action={updatePostModerationStatusAction}>
          <input type="hidden" name="entityId" value={eventId} />
          <input type="hidden" name="entityType" value="event" />
          <input type="hidden" name="status" value="approved" />
          <button type="submit" className={styles.publishButton}>Approve Event</button>
        </form>
      ) : null}
      <form action={updatePostModerationStatusAction} className={styles.eventDenialForm}>
        <input type="hidden" name="entityId" value={eventId} />
        <input type="hidden" name="entityType" value="event" />
        <input type="hidden" name="status" value="denied" />
        <label htmlFor={commentId} className={styles.formLabel}>
          Required correction notes
        </label>
        <textarea
          id={commentId}
          name="comment"
          required
          minLength={1}
          maxLength={1000}
          rows={4}
          className={styles.moderationTextarea}
          aria-describedby={`${commentId}-help`}
        />
        <p id={`${commentId}-help`} className={styles.businessMeta}>
          The owner will see this note and can edit and resubmit the same draft.
        </p>
        <button type="submit" className={styles.deleteButton}>
          Request Corrections
        </button>
      </form>
    </div>
  );
}

export default async function AdminPostsPage({ searchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const view = ["history", "payments"].includes(params?.view)
    ? params.view
    : "queue";
  const type = view === "payments" || params?.type === "events" ? "events" : "businesses";
  const requestedPage = Number.parseInt(params?.page ?? "1", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const skip = (page - 1) * PAGE_SIZE;

  let businesses = [];
  let events = [];
  let schemaNotice = null;

  try {
    [businesses, events] = await Promise.all([
      prisma.business.findMany({
        where: {
          status: view === "queue"
            ? "PENDING"
            : view === "history"
              ? { in: BUSINESS_HISTORY_STATUSES }
              : "PENDING",
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: PAGE_SIZE + 1,
        include: {
          city: true,
          owner: { select: { email: true, name: true } },
        },
      }),
      prisma.event.findMany({
        where: {
          ...(view === "payments"
            ? {
                OR: [
                  {
                    payments: {
                      some: {
                        status: {
                          in: [
                            "REVIEW_REQUIRED",
                            "REFUND_PENDING",
                            "REFUND_FAILED",
                            "DISPUTED",
                          ],
                        },
                      },
                    },
                  },
                  {
                    status: "CANCELLED",
                    cancellationReason: "PAYMENT_DISPUTE",
                    payments: { some: { stripeDisputeId: { not: null } } },
                  },
                ],
              }
            : {
                ...(view === "queue"
                  ? { status: "PENDING" }
                  : {
                      OR: [
                        { status: { in: EVENT_HISTORY_STATUSES } },
                        {
                          status: "DRAFT",
                          reviews: { some: { decision: "DENIED" } },
                        },
                      ],
                    }),
              }),
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: PAGE_SIZE + 1,
        include: {
          creator: { select: { email: true, name: true } },
          business: { select: { name: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              amountCents: true,
              chargedAmountCents: true,
              taxAmountCents: true,
              currency: true,
              paidAt: true,
              refundedAmountCents: true,
              refundApprovedAt: true,
              refundReason: true,
              stripeDisputeId: true,
              stripeDisputeStatus: true,
              failureReason: true,
            },
          },
          reviews: {
            orderBy: { createdAt: "desc" },
            include: {
              reviewer: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "Apply the latest Prisma migration to sync the moderation schema.";
    } else {
      throw error;
    }
  }

  const businessesHaveMore = businesses.length > PAGE_SIZE;
  const eventsHaveMore = events.length > PAGE_SIZE;
  businesses = businesses.slice(0, PAGE_SIZE);
  events = events.slice(0, PAGE_SIZE);
  const hasMore = type === "events" ? eventsHaveMore : businessesHaveMore;

  const filters = [
    {
      id: "businesses",
      label: "Businesses",
      count: businesses.length,
      href: `/admin/posts?type=businesses&view=${view}&page=1`,
    },
    {
      id: "events",
      label: "Events",
      count: events.length,
      href: `/admin/posts?type=events&view=${view}&page=1`,
    },
  ];

  const visibleRows = type === "events" ? events : businesses;

  return (
    <AdminShell activeTab="posts">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Review Queue</h1>
          <p className={styles.pageSubtitle}>
            Approve or deny submitted businesses and events before they appear publicly.
          </p>
        </div>
      </div>

      {schemaNotice ? <p style={{ color: "var(--retro-red)", marginBottom: "1rem" }}>{schemaNotice}</p> : null}

      <div className={styles.filterTabs}>
        {filters.map((filter) => (
          <Link
            key={filter.id}
            href={filter.href}
            className={`${styles.filterTab} ${type === filter.id ? styles.filterTabActive : ""}`}
          >
            {filter.label} <span className={styles.tabCount}>{filter.count}</span>
          </Link>
        ))}
      </div>

      <div className={styles.filterTabs} aria-label="Review queue view">
        <Link
          href={`/admin/posts?type=${type}&view=queue&page=1`}
          className={`${styles.filterTab} ${view === "queue" ? styles.filterTabActive : ""}`}
        >
          Pending Review
        </Link>
        <Link
          href={`/admin/posts?type=${type}&view=history&page=1`}
          className={`${styles.filterTab} ${view === "history" ? styles.filterTabActive : ""}`}
        >
          Published / Denied History
        </Link>
        <Link
          href="/admin/posts?type=events&view=payments&page=1"
          className={`${styles.filterTab} ${view === "payments" ? styles.filterTabActive : ""}`}
        >
          Payment Exceptions
        </Link>
      </div>

      <p className={styles.businessMeta}>Page {page}, up to {PAGE_SIZE} records.</p>

      {!schemaNotice && visibleRows.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Nothing to review</h3>
          <p className={styles.emptyStateDescription}>
            {type === "events"
              ? view === "queue"
                ? "New event submissions will appear here."
                : view === "payments"
                  ? "No event payment exceptions need attention."
                  : "No published or denied event history yet."
              : view === "queue"
                ? "New business submissions will appear here."
                : "No active or denied business history yet."}
          </p>
        </div>
      ) : null}

      {!schemaNotice && visibleRows.length > 0 && type === "businesses" ? (
        <div className={styles.businessesTable}>
          <div className={styles.tableHeader}>
            <div className={styles.tableCol} style={{ flex: 2 }}>
              Business
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Owner
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              City
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Submitted
            </div>
            <div className={styles.tableCol} style={{ flex: 1.25 }}>
              Status
            </div>
          </div>
          <div className={styles.tableBody}>
            {businesses.map((business) => (
              <div key={business.id} className={styles.tableRow}>
                <div className={styles.tableCol} style={{ flex: 2 }} data-label="Business">
                  <div>
                    <p className={styles.businessName}>{business.name}</p>
                    <p className={styles.businessMeta}>{business.slug}</p>
                  </div>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Owner">
                  <p className={styles.businessMeta}>{getOwnerLabel(business.owner)}</p>
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="City">
                  {business.city?.name ?? "-"}
                </div>
                <div className={styles.tableCol} style={{ flex: 1 }} data-label="Submitted">
                  {formatDate(business.updatedAt)}
                </div>
                <div className={styles.tableCol} style={{ flex: 1.25 }} data-label="Status">
                  <div className={styles.moderationStack}>
                    <span className={getModerationBadgeClass(business.status)}>{business.status}</span>
                    {view === "queue" ? (
                      <ModerationForm
                        entityId={business.id}
                        entityType="business"
                        currentStatus={business.status}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!schemaNotice && visibleRows.length > 0 && type === "events" ? (
        <div className={styles.businessesTable}>
          <div className={styles.tableHeader}>
            <div className={styles.tableCol} style={{ flex: 2 }}>
              Event
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Owner
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              Business
            </div>
            <div className={styles.tableCol} style={{ flex: 1 }}>
              City
            </div>
            <div className={styles.tableCol} style={{ flex: 1.25 }}>
              Status
            </div>
          </div>
          <div className={styles.tableBody}>
            {events.map((event) => {
              const latestPayment = event.payments[0];
              const ended = Boolean(event.endDate && event.endDate <= new Date());
              const canRestoreAfterDispute = Boolean(
                !ended &&
                event.status === "CANCELLED" &&
                event.cancellationReason === "PAYMENT_DISPUTE" &&
                event.payments.some(
                  (payment) =>
                    payment.status === "REVIEW_REQUIRED" &&
                    payment.paidAt &&
                    isFavorableEventDisputeStatus(payment.stripeDisputeStatus),
                )
              );
              const refundablePayments = event.payments.filter(
                (payment) =>
                  ["PAID", "REVIEW_REQUIRED", "REFUND_PENDING", "REFUND_FAILED"].includes(
                    payment.status,
                  ) &&
                  (
                    !payment.stripeDisputeId ||
                    isTerminalEventDisputeStatus(payment.stripeDisputeStatus)
                  ),
              );
              const paymentSummary = event.payments.length > 0
                ? event.payments.map((payment) => {
                    const total = payment.chargedAmountCents ?? payment.amountCents;
                    return `${payment.status} ${formatMoney(total, payment.currency)}`;
                  }).join(", ")
                : "No separate payment";

              return (
                <div key={event.id} className={styles.tableRow}>
                  <div className={styles.tableCol} style={{ flex: 2 }} data-label="Event">
                    <div>
                      <p className={styles.businessName}>{event.title}</p>
                      <p className={styles.businessMeta}>{formatDate(event.createdAt)}</p>
                      <p className={styles.businessMeta}>
                        {event.postingMethod === "ONE_TIME" ? "One-time post" : "Membership post"}
                        {` | Payments: ${paymentSummary}`}
                      </p>
                      {latestPayment?.failureReason ? (
                        <p className={styles.businessMeta}>{latestPayment.failureReason}</p>
                      ) : null}
                      <details>
                        <summary className={styles.actionButton}>Review Details</summary>
                        <p className={styles.businessMeta}>
                          {formatEventDateRange(
                            event.startDate,
                            event.endDate,
                            event.timezone,
                            { compact: true },
                          )}
                          {` | ${formatEventTime(event.startDate, event.timezone)} to ${formatEventTime(event.endDate, event.timezone)}`}
                          {` | ${event.timezone}`}
                        </p>
                        <p className={styles.businessMeta}>{event.description}</p>
                        <p className={styles.businessMeta}>
                          {[event.addressName, event.address, event.city, event.state, event.zipCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {event.imageUrl ? (
                          <a
                            href={getBlobImageUrl(event.imageUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionButton}
                          >
                            View Cover Image
                          </a>
                        ) : null}
                        {event.eventUrl ? (
                          <a
                            href={event.eventUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className={styles.actionButton}
                          >
                            Open Event Link
                          </a>
                        ) : null}
                        {event.reviews.length > 0 ? (
                          <section className={styles.reviewTimeline} aria-label="Event review history">
                            <h4 className={styles.reviewTimelineTitle}>Review History</h4>
                            <ol className={styles.reviewTimelineList}>
                              {event.reviews.map((review) => (
                                <li key={review.id} className={styles.reviewTimelineItem}>
                                  <strong>{review.decision}</strong>
                                  {` · ${formatDate(review.createdAt)} · ${getOwnerLabel(review.reviewer)}`}
                                  {review.comment ? <p>{review.comment}</p> : null}
                                </li>
                              ))}
                            </ol>
                          </section>
                        ) : null}
                        {event.payments.length > 0 ? (
                          <section className={styles.reviewTimeline} aria-label="Payment history">
                            <h4 className={styles.reviewTimelineTitle}>Payment History</h4>
                            <ol className={styles.reviewTimelineList}>
                              {event.payments.map((payment) => (
                                <li key={payment.id} className={styles.reviewTimelineItem}>
                                  <strong>{payment.status}</strong>
                                  {` · Subtotal ${formatMoney(payment.amountCents, payment.currency)}`}
                                  {` · Tax ${formatMoney(payment.taxAmountCents ?? 0, payment.currency)}`}
                                  {` · Total ${formatMoney(payment.chargedAmountCents ?? payment.amountCents, payment.currency)}`}
                                  {payment.refundApprovedAt ? (
                                    <p>
                                      Refund approved {formatDate(payment.refundApprovedAt)}: {payment.refundReason}
                                    </p>
                                  ) : null}
                                  {payment.stripeDisputeStatus ? (
                                    <p>Stripe dispute: {payment.stripeDisputeStatus}</p>
                                  ) : null}
                                </li>
                              ))}
                            </ol>
                          </section>
                        ) : null}
                      </details>
                    </div>
                  </div>
                  <div className={styles.tableCol} style={{ flex: 1 }} data-label="Owner">
                    <p className={styles.businessMeta}>{getOwnerLabel(event.creator)}</p>
                  </div>
                  <div className={styles.tableCol} style={{ flex: 1 }} data-label="Business">
                    {event.business?.name ?? "-"}
                  </div>
                  <div className={styles.tableCol} style={{ flex: 1 }} data-label="City">
                    {event.city}
                  </div>
                  <div className={styles.tableCol} style={{ flex: 1.25 }} data-label="Status">
                    <div className={styles.moderationStack}>
                      <span className={getModerationBadgeClass(event.status)}>
                        {ended ? `${event.status} / ENDED` : event.status}
                      </span>
                      {view === "queue" ? (
                        <EventModerationForm eventId={event.id} canApprove={!ended} />
                      ) : null}
                      {canRestoreAfterDispute ? (
                        <form action={restoreEventAfterDisputeAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <button type="submit" className={styles.actionButtonSecondary}>
                            Restore to Review Queue
                          </button>
                        </form>
                      ) : null}
                      {refundablePayments.map((payment) => {
                        const reasonId = `refund-reason-${payment.id}`;
                        const confirmId = `refund-confirm-${payment.id}`;
                        return (
                          <form
                            key={payment.id}
                            action={issueEventPaymentRefundAction}
                            className={styles.refundApprovalForm}
                          >
                            <input type="hidden" name="paymentId" value={payment.id} />
                            <p className={styles.businessMeta}>
                              Full refund: {formatMoney(
                                payment.chargedAmountCents ?? payment.amountCents,
                                payment.currency,
                              )}
                            </p>
                            <label htmlFor={reasonId} className={styles.formLabel}>
                              Refund reason
                            </label>
                            <textarea
                              id={reasonId}
                              name="reason"
                              required
                              minLength={5}
                              maxLength={500}
                              rows={3}
                              className={styles.moderationTextarea}
                            />
                            <label htmlFor={confirmId} className={styles.refundConfirmLabel}>
                              <input
                                id={confirmId}
                                type="checkbox"
                                name="confirmed"
                                value="yes"
                                required
                              />
                              Issue the full refund, including tax. This cannot be undone.
                            </label>
                            <button type="submit" className={styles.deleteButton}>
                              {payment.status === "REFUND_FAILED"
                                ? "Approve and Retry Full Refund"
                                : "Approve and Issue Full Refund"}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!schemaNotice && (page > 1 || hasMore) ? (
        <nav className={styles.filterTabs} aria-label="Review queue pagination">
          {page > 1 ? (
            <Link
              href={`/admin/posts?type=${type}&view=${view}&page=${page - 1}`}
              className={styles.filterTab}
            >
              Previous
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={`/admin/posts?type=${type}&view=${view}&page=${page + 1}`}
              className={styles.filterTab}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </AdminShell>
  );
}
