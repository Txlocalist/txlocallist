import { getSubscriptionAccessWhere } from "./membership-policy";

// Billing visibility is separate from moderation: payment recovery must never
// approve a draft, override an admin suspension, or revive deleted content.
export function getCreatorAccessWhere({ includeSoftDeletion = true } = {}) {
  return {
    ...(includeSoftDeletion ? { deletedAt: null } : {}),
    OR: [
      { role: { in: ["COMPLIMENTARY", "MANAGER", "ADMIN"] } },
      getSubscriptionAccessWhere("billingStatus"),
      { ownedBusinesses: { some: { subscription: { is: getSubscriptionAccessWhere() } } } },
    ],
  };
}

export function getPublicBusinessWhere({ includeSoftDeletion = true } = {}) {
  return {
    ...(includeSoftDeletion ? { deletedAt: null } : {}),
    status: "ACTIVE",
    publishedAt: { not: null },
    owner: getCreatorAccessWhere({ includeSoftDeletion }),
  };
}

export function getPublicEventAccessWhere({
  includeRecurrence = true,
  includeSoftDeletion = true,
} = {}) {
  const creatorAccess = getCreatorAccessWhere({ includeSoftDeletion });

  return {
    status: "PUBLISHED",
    ...(includeSoftDeletion
      ? { deletedAt: null, creator: { deletedAt: null } }
      : {}),
    AND: [
      ...(includeRecurrence
        ? [{
            OR: [
              { recurrence: "NONE" },
              {
                recurrence: "WEEKLY",
                postingMethod: { not: "ONE_TIME" },
                creator: creatorAccess,
              },
            ],
          }]
        : []),
      {
        OR: [
          { postingMethod: { in: ["ONE_TIME", "ADMIN"] } },
          {
            creator: creatorAccess,
            OR: [
              { businessId: null },
              {
                business: {
                  is: getPublicBusinessWhere({ includeSoftDeletion }),
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export function getOwnedEventWhere(creatorId) {
  return { creatorId, deletedAt: null };
}
