import Link from "next/link";

import {
  retryEventRefundAction,
  updatePostModerationStatusAction,
} from "@/app/actions/admin";
import { AdminShell } from "@/app/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { getBlobImageUrl } from "@/lib/blob";
import { formatEventDateRange, formatEventTime } from "@/lib/event-dates";
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
                      some: { status: { in: ["REFUND_PENDING", "REFUND_FAILED"] } },
                    },
                  },
                  {
                    status: "CANCELLED",
                    cancellationReason: "PAYMENT_DISPUTE",
                    payments: { some: { status: "PAID" } },
                  },
                ],
              }
            : {
                status: view === "queue"
                  ? "PENDING"
                  : { in: EVENT_HISTORY_STATUSES },
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
              status: true,
              amountCents: true,
              currency: true,
              failureReason: true,
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
                  ? "No event refunds need attention."
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
              const canRefundClosedDispute = Boolean(
                event.status === "CANCELLED" &&
                event.cancellationReason === "PAYMENT_DISPUTE" &&
                event.payments.some((payment) => payment.status === "PAID")
              );
              const needsRefundRetry = event.payments.some((payment) =>
                ["REFUND_FAILED", "REFUND_PENDING"].includes(payment.status)
              ) || Boolean(
                event.status === "DENIED" &&
                !event.publishedAt &&
                event.payments.some((payment) => payment.status === "PAID")
              ) || canRefundClosedDispute;
              const paymentSummary = event.payments.length > 0
                ? event.payments.map((payment) => payment.status).join(", ")
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
                        <ModerationForm
                          entityId={event.id}
                          entityType="event"
                          currentStatus={event.status}
                          canApprove={!ended}
                        />
                      ) : null}
                      {needsRefundRetry ? (
                        <form action={retryEventRefundAction}>
                          <input type="hidden" name="id" value={event.id} />
                          <button type="submit" className={styles.deleteButton}>
                            {canRefundClosedDispute ? "Issue Full Refund" : "Retry All Refunds"}
                          </button>
                        </form>
                      ) : null}
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
