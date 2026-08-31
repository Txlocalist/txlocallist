import { randomUUID } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { cancelEventPosting } from "@/lib/event-payments";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const RENEWAL_CAPABLE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);
const LOCAL_RENEWAL_CAPABLE_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "INCOMPLETE",
  "UNPAID",
  "PAUSED",
]);
const ACTIVE_ROLE_TRANSITION_STATUSES = [
  "PROCESSING",
  "PARTIAL",
  "STRIPE_VERIFIED",
  "NEEDS_ATTENTION",
];
const EXPIRABLE_ROLE_TRANSITION_STATUSES = [
  "PREVIEWED",
  "PROCESSING",
  "PARTIAL",
  "STRIPE_VERIFIED",
  "NEEDS_ATTENTION",
];

const USER_DELETION_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  roleVersion: true,
  deletedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  billingStatus: true,
  cancelAtPeriodEnd: true,
  ownedBusinesses: {
    select: {
      id: true,
      slug: true,
      subscription: {
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          status: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  },
  events: {
    select: {
      id: true,
      status: true,
      payments: { select: { id: true } },
    },
  },
  eventPayments: {
    select: {
      id: true,
      status: true,
    },
  },
  roleTransitionsAsActor: {
    where: { status: { in: ACTIVE_ROLE_TRANSITION_STATUSES } },
    select: { id: true },
  },
  roleTransitionsAsTarget: {
    where: { status: { in: ACTIVE_ROLE_TRANSITION_STATUSES } },
    select: { id: true },
  },
  _count: {
    select: {
      sessions: true,
      favorites: true,
      likes: true,
      eventFavorites: true,
      eventLikes: true,
    },
  },
};

function linkedStripeRecords(target) {
  const customerIds = new Set();
  const subscriptionIds = new Set();
  if (target.stripeCustomerId) customerIds.add(target.stripeCustomerId);
  if (target.stripeSubscriptionId) subscriptionIds.add(target.stripeSubscriptionId);

  for (const business of target.ownedBusinesses) {
    const subscription = business.subscription;
    if (subscription?.stripeCustomerId) customerIds.add(subscription.stripeCustomerId);
    if (subscription?.stripeSubscriptionId) {
      subscriptionIds.add(subscription.stripeSubscriptionId);
    }
  }
  return { customerIds, subscriptionIds };
}

async function inspectStripeRenewals(target) {
  const { customerIds, subscriptionIds } = linkedStripeRecords(target);
  if (customerIds.size === 0 && subscriptionIds.size === 0) {
    return { checked: true, renewals: [] };
  }
  if (!isStripeConfigured()) {
    return {
      checked: false,
      renewals: [],
      error: "Stripe must be available to verify that renewal is stopped.",
    };
  }

  const stripe = getStripe();
  const subscriptions = new Map();
  try {
    for (const subscriptionId of subscriptionIds) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptions.set(subscription.id, subscription);
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;
      if (customerId) customerIds.add(customerId);
    }

    for (const customerId of customerIds) {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) continue;
      const [listed, openCheckouts, schedules] = await Promise.all([
        stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        }),
        stripe.checkout.sessions.list({
          customer: customerId,
          status: "open",
          limit: 100,
        }),
        stripe.subscriptionSchedules.list({
          customer: customerId,
          limit: 100,
        }),
      ]);
      if (listed.has_more || openCheckouts.has_more || schedules.has_more) {
        return {
          checked: false,
          renewals: [],
          error: "This Stripe customer has too many subscriptions for an automatic safety check.",
        };
      }
      for (const subscription of listed.data) {
        subscriptions.set(subscription.id, subscription);
      }
      for (const checkout of openCheckouts.data) {
        if (checkout.mode === "subscription") {
          subscriptions.set(`checkout:${checkout.id}`, {
            id: checkout.id,
            status: "open subscription checkout",
            cancel_at_period_end: false,
            deletionRisk: true,
          });
        }
      }
      for (const schedule of schedules.data) {
        if (["active", "not_started"].includes(schedule.status)) {
          subscriptions.set(`schedule:${schedule.id}`, {
            id: schedule.id,
            status: `${schedule.status} subscription schedule`,
            cancel_at_period_end: false,
            deletionRisk: true,
          });
        }
      }
    }
  } catch {
    return {
      checked: false,
      renewals: [],
      error: "Stripe renewal status could not be verified. Reconcile billing and try again.",
    };
  }

  return {
    checked: true,
    renewals: Array.from(subscriptions.values())
      .filter(
        (subscription) =>
          subscription.deletionRisk ||
          (RENEWAL_CAPABLE_STATUSES.has(subscription.status) &&
            !subscription.cancel_at_period_end),
      )
      .map((subscription) => ({ id: subscription.id, status: subscription.status })),
  };
}

function hasLocalUnscheduledRenewal(target) {
  const records = [
    {
      id: target.stripeSubscriptionId,
      status: target.billingStatus,
      cancelAtPeriodEnd: target.cancelAtPeriodEnd,
    },
    ...target.ownedBusinesses.map((business) => ({
      id: business.subscription?.stripeSubscriptionId,
      status: business.subscription?.status,
      cancelAtPeriodEnd: business.subscription?.cancelAtPeriodEnd,
    })),
  ];

  return records.some(
    (record) =>
      LOCAL_RENEWAL_CAPABLE_STATUSES.has(record.status) &&
      !record.cancelAtPeriodEnd,
  );
}

export function getUserDeletionBlockers({
  actorId,
  target,
  adminCount,
  stripeInspection = { checked: true, renewals: [] },
}) {
  const blockers = [];
  if (!target) return ["User not found."];
  if (target.deletedAt) blockers.push("This account has already been deleted.");
  if (actorId === target.id) blockers.push("You cannot delete your own account.");
  if (target.role === "ADMIN" && adminCount <= 1) {
    blockers.push("The final Admin account cannot be deleted.");
  }
  if (
    target.roleTransitionsAsActor.length > 0 ||
    target.roleTransitionsAsTarget.length > 0
  ) {
    blockers.push("Finish or resolve the active role change before deleting this account.");
  }
  if (
    target.eventPayments.some((payment) =>
      ["CREATED", "PROCESSING"].includes(payment.status),
    )
  ) {
    blockers.push(
      "An active event payment Checkout must finish or expire before deleting this account.",
    );
  }
  if (stripeInspection.error) blockers.push(stripeInspection.error);
  if (
    stripeInspection.renewals.some((renewal) =>
      renewal.status.includes("open subscription checkout"),
    )
  ) {
    blockers.push(
      "An open subscription Checkout must expire or be closed in Stripe before deletion.",
    );
  }
  if (
    stripeInspection.renewals.some((renewal) =>
      renewal.status.includes("subscription schedule"),
    )
  ) {
    blockers.push("Cancel or release the subscription schedule in Stripe before deletion.");
  }
  if (
    stripeInspection.renewals.some(
      (renewal) =>
        !renewal.status.includes("open subscription checkout") &&
        !renewal.status.includes("subscription schedule"),
    ) ||
    hasLocalUnscheduledRenewal(target)
  ) {
    blockers.push(
      "Future renewal is still active. Change the role to Complimentary first so cancellation is verified.",
    );
  }
  return blockers;
}

export function buildUserDeletionImpact(target) {
  const retainedPaymentIds = new Set([
    ...target.eventPayments.map((payment) => payment.id),
    ...target.events.flatMap((event) =>
      event.payments.map((payment) => payment.id),
    ),
  ]);

  return {
    businessesArchived: target.ownedBusinesses.length,
    eventsCancelled: target.events.filter((event) =>
      ["DRAFT", "PENDING", "PUBLISHED"].includes(event.status),
    ).length,
    sessionsRemoved: target._count.sessions,
    savedItemsRemoved:
      target._count.favorites +
      target._count.likes +
      target._count.eventFavorites +
      target._count.eventLikes,
    billingRecordsRetained: retainedPaymentIds.size,
  };
}

async function loadDeletionTarget(targetUserId, db = prisma) {
  return db.user.findUnique({
    where: { id: targetUserId },
    select: USER_DELETION_SELECT,
  });
}

export async function previewUserDeletion({ actorId, targetUserId }) {
  const target = await loadDeletionTarget(targetUserId);
  if (!target) throw new Error("User not found.");
  const [adminCount, stripeInspection] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
    inspectStripeRenewals(target),
  ]);
  const blockers = getUserDeletionBlockers({
    actorId,
    target,
    adminCount,
    stripeInspection,
  });

  return {
    target: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      roleVersion: target.roleVersion,
    },
    impact: buildUserDeletionImpact(target),
    blockers,
    canDelete: blockers.length === 0,
  };
}

export function isDeletionConfirmationValid(confirmationEmail, targetEmail) {
  return (
    typeof confirmationEmail === "string" &&
    confirmationEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase()
  );
}

export async function deleteUserAccount({
  actorId,
  targetUserId,
  expectedRoleVersion,
  confirmationEmail,
  confirmed,
}) {
  if (!confirmed) throw new Error("Confirm the permanent account deletion.");

  const preview = await previewUserDeletion({ actorId, targetUserId });
  if (!isDeletionConfirmationValid(confirmationEmail, preview.target.email)) {
    throw new Error("Type the account email exactly to confirm deletion.");
  }
  if (preview.target.roleVersion !== expectedRoleVersion) {
    throw new Error("The account changed. Review the deletion again.");
  }
  if (preview.blockers.length > 0) throw new Error(preview.blockers[0]);

  const targetBeforeCancellation = await loadDeletionTarget(targetUserId);
  if (
    !targetBeforeCancellation ||
    targetBeforeCancellation.roleVersion !== expectedRoleVersion ||
    targetBeforeCancellation.deletedAt
  ) {
    throw new Error("The account changed. Review the deletion again.");
  }
  for (const event of targetBeforeCancellation.events) {
    if (["DRAFT", "PENDING", "PUBLISHED"].includes(event.status)) {
      await cancelEventPosting(event.id, "ADMIN");
    }
  }
  const finalStripeInspection = await inspectStripeRenewals(targetBeforeCancellation);
  if (finalStripeInspection.error || finalStripeInspection.renewals.length > 0) {
    throw new Error(
      finalStripeInspection.error ||
        "Future renewal became active. Review billing before deleting this account.",
    );
  }

  const now = new Date();
  const passwordHash = await hashPassword(randomUUID());
  const anonymizedEmail = `deleted+${targetUserId}@deleted.txlocalist.invalid`;

  await prisma.$transaction(
    async (tx) => {
      const target = await loadDeletionTarget(targetUserId, tx);
      if (!target || target.deletedAt) throw new Error("This account is already deleted.");
      if (target.roleVersion !== expectedRoleVersion) {
        throw new Error("The account changed. Review the deletion again.");
      }
      if (actorId === target.id) throw new Error("You cannot delete your own account.");

      if (target.role === "ADMIN") {
        const adminCount = await tx.user.count({
          where: { role: "ADMIN", deletedAt: null },
        });
        if (adminCount <= 1) throw new Error("The final Admin account cannot be deleted.");
      }
      if (
        target.roleTransitionsAsActor.length > 0 ||
        target.roleTransitionsAsTarget.length > 0
      ) {
        throw new Error("Finish or resolve the active role change before deleting this account.");
      }
      if (
        target.eventPayments.some((payment) =>
          ["CREATED", "PROCESSING"].includes(payment.status),
        )
      ) {
        throw new Error(
          "An active event payment Checkout must finish or expire before deleting this account.",
        );
      }
      if (hasLocalUnscheduledRenewal(target)) {
        throw new Error("Future renewal is still active. Review billing and try again.");
      }

      await tx.roleTransitionOperation.updateMany({
        where: {
          OR: [{ actorId: target.id }, { targetUserId: target.id }],
          status: { in: EXPIRABLE_ROLE_TRANSITION_STATUSES },
        },
        data: { status: "EXPIRED", activeTargetKey: null },
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.favorite.deleteMany({ where: { userId: target.id } });
      await tx.like.deleteMany({ where: { userId: target.id } });
      await tx.eventFavorite.deleteMany({ where: { userId: target.id } });
      await tx.eventLike.deleteMany({ where: { userId: target.id } });
      await tx.eventImageUploadRateLimit.deleteMany({ where: { userId: target.id } });

      await tx.favorite.deleteMany({
        where: { business: { ownerId: target.id } },
      });
      await tx.like.deleteMany({
        where: { business: { ownerId: target.id } },
      });

      await tx.business.updateMany({
        where: { ownerId: target.id },
        data: {
          status: "ARCHIVED",
          publishedAt: null,
          phone: null,
          email: null,
          website: null,
          isHiring: false,
          hiringRoles: "[]",
        },
      });
      await tx.socialLink.deleteMany({
        where: { business: { ownerId: target.id } },
      });
      await tx.job.updateMany({
        where: { business: { ownerId: target.id } },
        data: { status: "ARCHIVED" },
      });
      await tx.event.updateMany({
        where: {
          creatorId: target.id,
          status: { in: ["DRAFT", "PENDING", "PUBLISHED"] },
        },
        data: {
          status: "CANCELLED",
          publishedAt: null,
          cancelledAt: now,
          cancellationReason: "ADMIN",
        },
      });
      await tx.user.update({
        where: { id: target.id },
        data: {
          email: anonymizedEmail,
          passwordHash,
          role: "USER",
          roleVersion: { increment: 1 },
          name: null,
          avatarUrl: null,
          lastLoginAt: null,
          deletedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_ACCOUNT_DELETED",
          entity: "User",
          entityId: target.id,
          meta: JSON.stringify({
            previousRole: target.role,
            ...preview.impact,
          }),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return {
    id: targetUserId,
    businessSlugs: targetBeforeCancellation.ownedBusinesses.map(
      (business) => business.slug,
    ),
    eventIds: targetBeforeCancellation.events.map((event) => event.id),
  };
}
