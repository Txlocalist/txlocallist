import Link from "next/link";

import { AdminShell } from "../AdminShell";
import { UserRoleControl } from "./UserRoleControl";
import { UserDeleteControl } from "./UserDeleteControl";
import { requireStaff } from "@/lib/auth/session";
import {
  ACCOUNT_ROLES,
  deriveUserStatusTags,
  getAccessFilterWhere,
} from "@/lib/account-access";
import { prisma } from "@/lib/prisma";
import { isComplimentaryRoleMutationsEnabled } from "@/lib/runtime-config.mjs";
import dashboardStyles from "@/app/dashboard/dashboard.module.css";
import styles from "./users.module.css";

const PAGE_SIZE = 50;
const ACCESS_FILTERS = new Set([
  "free",
  "paid",
  "complimentary",
  "staff",
  "owner",
  "one-time",
]);

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function toneClass(tone) {
  return {
    success: styles.toneSuccess,
    accent: styles.toneAccent,
    staff: styles.toneStaff,
    muted: styles.toneMuted,
    neutral: styles.toneNeutral,
    warning: styles.toneWarning,
    danger: styles.toneDanger,
  }[tone] ?? styles.toneNeutral;
}

function pageHref({ page, query, role, access }) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  if (role) params.set("role", role);
  if (access) params.set("access", access);
  const search = params.toString();
  return search ? `/admin/users?${search}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }) {
  const viewer = await requireStaff();
  const isAdmin = viewer.role === "ADMIN";
  const complimentaryRoleMutationsEnabled = isComplimentaryRoleMutationsEnabled();
  const params = await searchParams;
  const query = params?.q?.toString().trim().slice(0, 100) ?? "";
  const requestedRole = params?.role?.toString().toUpperCase() ?? "";
  const role = ACCOUNT_ROLES.includes(requestedRole) ? requestedRole : "";
  const requestedAccess = params?.access?.toString().toLowerCase() ?? "";
  const access = ACCESS_FILTERS.has(requestedAccess) ? requestedAccess : "";
  const requestedPage = Number.parseInt(params?.page ?? "1", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const filters = [
    query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : null,
    role ? { role } : null,
    getAccessFilterWhere(access),
  ].filter(Boolean);
  const where = {
    AND: [{ deletedAt: null }, ...filters],
  };

  const select = {
    id: true,
    email: true,
    name: true,
    role: true,
    roleVersion: true,
    billingStatus: true,
    stripeSubscriptionId: true,
    currentPeriodEnd: true,
    cancelAtPeriodEnd: true,
    createdAt: true,
    ...(isAdmin ? { lastLoginAt: true } : {}),
    _count: { select: { ownedBusinesses: true } },
    eventPayments: {
      where: { paidAt: { not: null } },
      select: { id: true },
      take: 1,
    },
    ownedBusinesses: {
      select: {
        subscription: {
          select: {
            status: true,
            stripeSubscriptionId: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    },
    ...(isAdmin
      ? {
          roleTransitionsAsTarget: {
            where: {
              activeTargetKey: { not: null },
              status: {
                in: [
                  "PREVIEWED",
                  "PROCESSING",
                  "PARTIAL",
                  "STRIPE_VERIFIED",
                  "NEEDS_ATTENTION",
                ],
              },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              fromRole: true,
              toRole: true,
              status: true,
              expiresAt: true,
              errorMessage: true,
              subscriptions: {
                select: {
                  stripeSubscriptionId: true,
                  stripeStatus: true,
                  amountCents: true,
                  currency: true,
                  priorCancelAtPeriodEnd: true,
                  currentPeriodEnd: true,
                },
              },
            },
          },
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeTab="users">
      <div className={dashboardStyles.pageHeader}>
        <div>
          <h1 className={dashboardStyles.pageTitle}>{isAdmin ? "Manage Users" : "Users"}</h1>
          <p className={dashboardStyles.pageSubtitle}>
            {total} matching account{total === 1 ? "" : "s"}. Roles control permissions; status tags are calculated automatically.
          </p>
        </div>
      </div>

      <form method="get" className={styles.toolbar} role="search">
        <div className={styles.field}>
          <label htmlFor="user-search" className={styles.label}>Search</label>
          <input id="user-search" name="q" defaultValue={query} placeholder="Name or email" className={styles.input} />
        </div>
        <div className={styles.field}>
          <label htmlFor="role-filter" className={styles.label}>Role</label>
          <select id="role-filter" name="role" defaultValue={role} className={styles.input}>
            <option value="">All roles</option>
            <option value="USER">User</option>
            <option value="COMPLIMENTARY">Complimentary</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="access-filter" className={styles.label}>Status</label>
          <select id="access-filter" name="access" defaultValue={access} className={styles.input}>
            <option value="">All statuses</option>
            <option value="free">Free</option>
            <option value="paid">Paid Subscriber</option>
            <option value="complimentary">Complimentary Access</option>
            <option value="staff">Staff Access</option>
            <option value="owner">Business Owner</option>
            <option value="one-time">One-Time Event Buyer</option>
          </select>
        </div>
        <button type="submit" className={styles.searchButton}>Apply filters</button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>TX Localist user accounts and access status</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Listings</th>
              <th scope="col">Joined</th>
              {isAdmin ? <th scope="col">Last login</th> : null}
              {isAdmin ? <th scope="col">Account controls</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const legacySubscriptions = user.ownedBusinesses
                .map((business) => business.subscription)
                .filter(Boolean);
              const tags = deriveUserStatusTags({
                role: user.role,
                billingStatus: user.billingStatus,
                stripeSubscriptionId: user.stripeSubscriptionId,
                currentPeriodEnd: user.currentPeriodEnd,
                cancelAtPeriodEnd: user.cancelAtPeriodEnd,
                legacySubscriptions,
                ownedBusinessCount: user._count.ownedBusinesses,
                hasPaidEventPayment: user.eventPayments.length > 0,
                includeBillingHealth: isAdmin,
              });
              const storedTransition = isAdmin
                ? user.roleTransitionsAsTarget?.[0] ?? null
                : null;
              const activeTransition = storedTransition && !(
                storedTransition.status === "PREVIEWED" &&
                storedTransition.expiresAt <= new Date()
              )
                ? {
                    id: storedTransition.id,
                    status: storedTransition.status,
                    errorMessage: storedTransition.errorMessage,
                    target: {
                      id: user.id,
                      email: user.email,
                      name: user.name,
                      role: storedTransition.fromRole,
                    },
                    toRole: storedTransition.toRole,
                    expiresAt: storedTransition.expiresAt.toISOString(),
                    subscriptions: storedTransition.subscriptions.map((subscription) => ({
                      id: subscription.stripeSubscriptionId,
                      status: subscription.stripeStatus,
                      amountCents: subscription.amountCents,
                      currency: subscription.currency,
                      cancelAtPeriodEnd: subscription.priorCancelAtPeriodEnd,
                      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
                    })),
                  }
                : null;

              return (
                <tr key={user.id}>
                  <td>
                    <div className={styles.identity}>
                      <strong>{user.name?.trim() || "Unnamed user"}</strong>
                      <span>{user.email}</span>
                    </div>
                  </td>
                  <td><span className={styles.roleBadge}>{user.role}</span></td>
                  <td>
                    <div className={styles.tagList}>
                      {tags.map((tag) => (
                        <span key={tag.key} className={`${styles.statusTag} ${toneClass(tag.tone)}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{user._count.ownedBusinesses}</td>
                  <td className={styles.muted}>{formatDate(user.createdAt)}</td>
                  {isAdmin ? <td className={styles.muted}>{formatDate(user.lastLoginAt)}</td> : null}
                  {isAdmin ? (
                    <td>
                      <UserRoleControl
                        userId={user.id}
                        email={user.email}
                        currentRole={user.role}
                        complimentaryRoleMutationsEnabled={complimentaryRoleMutationsEnabled}
                        activeTransition={activeTransition}
                      />
                      <UserDeleteControl
                        userId={user.id}
                        email={user.email}
                        isCurrentUser={user.id === viewer.id}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 ? (
        <div className={dashboardStyles.emptyState}>
          <h2 className={dashboardStyles.emptyStateTitle}>No users found</h2>
          <p className={dashboardStyles.emptyStateDescription}>Adjust the search or filters and try again.</p>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="User results pagination">
          {page > 1 ? <Link href={pageHref({ page: page - 1, query, role, access })}>Previous</Link> : <span />}
          <span className={styles.muted}>Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={pageHref({ page: page + 1, query, role, access })}>Next</Link> : <span />}
        </nav>
      ) : null}
    </AdminShell>
  );
}
