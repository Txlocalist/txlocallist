import { prisma } from "@/lib/prisma";

export const PAID_ACCESS_STATUSES = Object.freeze(["ACTIVE", "TRIALING"]);
export const STAFF_ROLES = Object.freeze(["MANAGER", "ADMIN"]);
export const ACCOUNT_ROLES = Object.freeze([
  "USER",
  "COMPLIMENTARY",
  "MANAGER",
  "ADMIN",
]);

const PLAN_SELECT = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  billingPeriod: true,
  features: true,
};

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

export function hasStripeFeatureAccess(status) {
  return PAID_ACCESS_STATUSES.includes(status);
}

function billingDates(record) {
  return {
    currentPeriodEnd: record?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(record?.cancelAtPeriodEnd),
    canceledAt: record?.canceledAt ?? null,
  };
}

export function resolveAccountAccess({
  user,
  freePlan,
  starterPlan,
  legacySubscriptions = [],
}) {
  if (!user) return null;

  const accountHasStripeAccess =
    Boolean(user.stripeSubscriptionId) && hasStripeFeatureAccess(user.billingStatus);
  const activeLegacy = legacySubscriptions.find((subscription) =>
    Boolean(subscription.stripeSubscriptionId) &&
    hasStripeFeatureAccess(subscription.status),
  );
  const hasLegacyStripeAccess = Boolean(activeLegacy);
  const hasStripeAccess = accountHasStripeAccess || hasLegacyStripeAccess;
  const hasComplimentaryAccess = user.role === "COMPLIMENTARY";
  const hasStaffAccess = isStaffRole(user.role);
  const hasMembershipAccess = hasStripeAccess || hasComplimentaryAccess;
  const hasCreatorAccess = hasMembershipAccess || hasStaffAccess;

  const paidPlan = accountHasStripeAccess
    ? user.accountPlan
    : hasLegacyStripeAccess
      ? activeLegacy.plan
      : null;
  const rolePlan = hasComplimentaryAccess || hasStaffAccess ? starterPlan : null;
  const effectivePlan = paidPlan ?? rolePlan ?? freePlan;
  const billingRecord = accountHasStripeAccess
    ? user
    : hasLegacyStripeAccess
      ? activeLegacy
      : null;
  const linkedSubscriptionIds = Array.from(
    new Set(
      [
        user.stripeSubscriptionId,
        ...legacySubscriptions.map((subscription) => subscription.stripeSubscriptionId),
      ].filter(Boolean),
    ),
  );
  const stripeCustomerId =
    user.stripeCustomerId ??
    legacySubscriptions.find((subscription) => subscription.stripeCustomerId)
      ?.stripeCustomerId ??
    null;

  const primaryAccessSource = accountHasStripeAccess
    ? "STRIPE_ACCOUNT"
    : hasLegacyStripeAccess
      ? "STRIPE_LEGACY"
      : hasComplimentaryAccess
        ? "COMPLIMENTARY"
        : hasStaffAccess
          ? "STAFF"
          : "FREE";

  return {
    ...user,
    sources: {
      stripeAccount: accountHasStripeAccess,
      stripeLegacy: hasLegacyStripeAccess,
      complimentary: hasComplimentaryAccess,
      staff: hasStaffAccess,
    },
    primaryAccessSource,
    hasStripeAccess,
    hasPaidAccess: hasStripeAccess,
    hasComplimentaryAccess,
    hasStaffAccess,
    hasMembershipAccess,
    hasCreatorAccess,
    effectivePlan,
    activePlan: effectivePlan,
    activePlanId: effectivePlan?.id ?? null,
    activeStatus: billingRecord?.status ?? billingRecord?.billingStatus ?? null,
    stripeCustomerId,
    stripeSubscriptionId:
      billingRecord?.stripeSubscriptionId ?? linkedSubscriptionIds[0] ?? null,
    linkedSubscriptionIds,
    canStartCheckout: user.role === "USER" && linkedSubscriptionIds.length === 0,
    canOpenPortal:
      user.role !== "COMPLIMENTARY" &&
      Boolean(stripeCustomerId) &&
      linkedSubscriptionIds.length > 0,
    ...billingDates(billingRecord),
  };
}

export async function getAccountAccess(
  userId,
  db = prisma,
  { includeDeleted = false } = {},
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deletedAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      accountPlanId: true,
      accountPlan: { select: PLAN_SELECT },
    },
  });

  if (!user || (user.deletedAt && !includeDeleted)) return null;

  const [freePlan, starterPlan, legacySubscriptions] = await Promise.all([
    db.plan.findUnique({ where: { slug: "free" }, select: PLAN_SELECT }),
    db.plan.findUnique({ where: { slug: "starter" }, select: PLAN_SELECT }),
    db.subscription.findMany({
      where: { business: { ownerId: userId } },
      include: {
        plan: { select: PLAN_SELECT },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!freePlan) throw new Error("The free plan is missing.");
  if (!starterPlan) throw new Error("The Starter plan is missing.");

  return resolveAccountAccess({ user, freePlan, starterPlan, legacySubscriptions });
}

export async function syncEffectiveAccessPlans(userId, db = prisma) {
  const access = await getAccountAccess(userId, db, { includeDeleted: true });
  if (!access?.activePlanId) {
    throw new Error("Unable to resolve an effective account plan.");
  }
  if (access.deletedAt) return access.activePlanId;

  await db.user.update({
    where: { id: userId },
    data: { accountPlanId: access.activePlanId },
  });
  await db.business.updateMany({
    where: { ownerId: userId },
    data: { planId: access.activePlanId },
  });

  return access.activePlanId;
}

export function deriveUserStatusTags({
  role,
  billingStatus,
  stripeSubscriptionId,
  legacySubscriptions = [],
  ownedBusinessCount = 0,
  hasPaidEventPayment = false,
  includeBillingHealth = false,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
}) {
  const hasAccountPaidAccess =
    Boolean(stripeSubscriptionId) && hasStripeFeatureAccess(billingStatus);
  const activeLegacy = legacySubscriptions.find(
    (subscription) =>
      Boolean(subscription.stripeSubscriptionId) &&
      hasStripeFeatureAccess(subscription.status),
  );
  const hasPaidAccess = hasAccountPaidAccess || Boolean(activeLegacy);
  const tags = [];

  if (hasPaidAccess) tags.push({ key: "paid", label: "Paid Subscriber", tone: "success" });
  if (role === "COMPLIMENTARY") {
    tags.push({ key: "complimentary", label: "Complimentary Access", tone: "accent" });
  }
  if (isStaffRole(role)) tags.push({ key: "staff", label: "Staff Access", tone: "staff" });
  if (!hasPaidAccess && role === "USER") {
    tags.push({ key: "free", label: "Free", tone: "muted" });
  }
  if (ownedBusinessCount > 0) {
    tags.push({ key: "owner", label: "Business Owner", tone: "neutral" });
  }
  if (hasPaidEventPayment) {
    tags.push({ key: "one-time", label: "One-Time Event Buyer", tone: "neutral" });
  }

  if (includeBillingHealth) {
    const activeRecord = hasAccountPaidAccess
      ? { status: billingStatus, cancelAtPeriodEnd, currentPeriodEnd }
      : activeLegacy;
    const status = activeRecord?.status ?? billingStatus;

    if (status === "TRIALING") {
      tags.push({ key: "trialing", label: "Trialing", tone: "warning" });
    }
    if (activeRecord?.cancelAtPeriodEnd) {
      tags.push({ key: "ending", label: "Cancels at Period End", tone: "warning" });
    }
    if (["PAST_DUE", "UNPAID", "INCOMPLETE", "PAUSED"].includes(status)) {
      tags.push({
        key: `billing-${status.toLowerCase()}`,
        label: status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        tone: "danger",
      });
    }
    if (status === "CANCELED") {
      tags.push({ key: "billing-canceled", label: "Canceled", tone: "muted" });
    }
  }

  return tags;
}

export function getAccessFilterWhere(access) {
  const paidWhere = {
    OR: [
      {
        billingStatus: { in: PAID_ACCESS_STATUSES },
        stripeSubscriptionId: { not: null },
      },
      {
        ownedBusinesses: {
          some: {
            subscription: {
              is: {
                status: { in: PAID_ACCESS_STATUSES },
                stripeSubscriptionId: { not: null },
              },
            },
          },
        },
      },
    ],
  };

  if (access === "paid") return paidWhere;
  if (access === "complimentary") return { role: "COMPLIMENTARY" };
  if (access === "staff") return { role: { in: STAFF_ROLES } };
  if (access === "owner") return { ownedBusinesses: { some: {} } };
  if (access === "one-time") {
    return { eventPayments: { some: { paidAt: { not: null } } } };
  }
  if (access === "free") {
    return { role: "USER", NOT: paidWhere };
  }

  return null;
}
