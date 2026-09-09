import { getSubscriptionAccessWhere } from "./membership-policy";

// Billing visibility is separate from moderation: payment recovery must never
// approve a draft, override an admin suspension, or revive deleted content.
export function getCreatorAccessWhere() {
  return {
    deletedAt: null,
    OR: [
      { role: { in: ["COMPLIMENTARY", "MANAGER", "ADMIN"] } },
      getSubscriptionAccessWhere("billingStatus"),
      { ownedBusinesses: { some: { subscription: { is: getSubscriptionAccessWhere() } } } },
    ],
  };
}

export function getPublicBusinessWhere() {
  return { deletedAt: null, status: "ACTIVE", publishedAt: { not: null }, owner: getCreatorAccessWhere() };
}

export function getPublicEventAccessWhere() {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    creator: { deletedAt: null },
    AND: [{ OR: [
      { postingMethod: { in: ["ONE_TIME", "ADMIN"] } },
      { creator: getCreatorAccessWhere(), OR: [
        { businessId: null },
        { business: { is: getPublicBusinessWhere() } },
      ] },
    ] }],
  };
}

export function getOwnedEventWhere(creatorId) {
  return { creatorId, deletedAt: null };
}
