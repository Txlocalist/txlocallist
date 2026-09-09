export const PAID_ACCESS_STATUSES = Object.freeze(["ACTIVE", "TRIALING"]);

export function hasSubscriptionAccess(record, now = new Date()) {
  return Boolean(record?.stripeSubscriptionId) &&
    PAID_ACCESS_STATUSES.includes(record.status ?? record.billingStatus) &&
    !(record.cancelAtPeriodEnd && record.currentPeriodEnd && new Date(record.currentPeriodEnd) <= now);
}

export function getSubscriptionAccessWhere(statusField = "status", now = new Date()) {
  return {
    stripeSubscriptionId: { not: null },
    [statusField]: { in: PAID_ACCESS_STATUSES },
    OR: [
      { cancelAtPeriodEnd: false },
      { currentPeriodEnd: null },
      { currentPeriodEnd: { gt: now } },
    ],
  };
}
