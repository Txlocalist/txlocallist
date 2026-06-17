import Link from "next/link";

import { updatePostModerationStatusAction } from "@/app/actions/admin";
import { AdminShell } from "@/app/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isMissingPrismaTableError } from "@/lib/prisma-errors";
import styles from "@/app/dashboard/dashboard.module.css";

const BUSINESS_REVIEW_STATUSES = ["PENDING", "DENIED", "ACTIVE"];
const EVENT_REVIEW_STATUSES = ["PENDING", "DENIED", "PUBLISHED"];

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

function ModerationForm({ entityId, entityType, currentStatus }) {
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
        <option value="approved">Approved</option>
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
  const type = params?.type === "events" ? "events" : "businesses";

  let businesses = [];
  let events = [];
  let schemaNotice = null;

  try {
    [businesses, events] = await Promise.all([
      prisma.business.findMany({
        where: { status: { in: BUSINESS_REVIEW_STATUSES } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          city: true,
          owner: { select: { email: true, name: true } },
        },
      }),
      prisma.event.findMany({
        where: { status: { in: EVENT_REVIEW_STATUSES } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          creator: { select: { email: true, name: true } },
          business: { select: { name: true } },
        },
      }),
    ]);
  } catch (error) {
    if (isMissingPrismaTableError(error)) {
      schemaNotice = "Run npm run db:push to sync the moderation schema.";
    } else {
      throw error;
    }
  }

  const filters = [
    { id: "businesses", label: "Businesses", count: businesses.length, href: "/admin/posts?type=businesses" },
    { id: "events", label: "Events", count: events.length, href: "/admin/posts?type=events" },
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

      {!schemaNotice && visibleRows.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>Nothing to review</h3>
          <p className={styles.emptyStateDescription}>
            {type === "events"
              ? "New event submissions will appear here."
              : "New business submissions will appear here."}
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
                    <ModerationForm
                      entityId={business.id}
                      entityType="business"
                      currentStatus={business.status}
                    />
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
            {events.map((event) => (
              <div key={event.id} className={styles.tableRow}>
                <div className={styles.tableCol} style={{ flex: 2 }} data-label="Event">
                  <div>
                    <p className={styles.businessName}>{event.title}</p>
                    <p className={styles.businessMeta}>{formatDate(event.createdAt)}</p>
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
                    <span className={getModerationBadgeClass(event.status)}>{event.status}</span>
                    <ModerationForm entityId={event.id} entityType="event" currentStatus={event.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
