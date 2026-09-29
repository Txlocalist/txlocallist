import { Prisma } from "@prisma/client";
import { PAID_ACCESS_STATUSES } from "./membership-policy";

// SQL counterpart of getPublicBusinessWhere for correlated directory queries.
// Aliases b (Business) and u (User) are fixed, never supplied by a request.
// PostgreSQL parity tests cover account and legacy subscription eligibility.
export function getPublicBusinessSql(now = new Date()) {
  return Prisma.sql`
    b."deletedAt" IS NULL AND b."status" = 'ACTIVE'
    AND b."publishedAt" IS NOT NULL AND u."deletedAt" IS NULL
    AND (
      u."role" IN ('COMPLIMENTARY', 'MANAGER', 'ADMIN')
      OR (
        u."stripeSubscriptionId" IS NOT NULL
        AND u."billingStatus"::text IN (${Prisma.join(PAID_ACCESS_STATUSES)})
        AND (NOT u."cancelAtPeriodEnd" OR u."currentPeriodEnd" IS NULL OR u."currentPeriodEnd" > ${now})
      )
      OR EXISTS (
        SELECT 1 FROM "Business" owned
        JOIN "Subscription" s ON s."businessId" = owned."id"
        WHERE owned."ownerId" = u."id" AND s."stripeSubscriptionId" IS NOT NULL
          AND s."status"::text IN (${Prisma.join(PAID_ACCESS_STATUSES)})
          AND (NOT s."cancelAtPeriodEnd" OR s."currentPeriodEnd" IS NULL OR s."currentPeriodEnd" > ${now})
      )
    )`;
}

export function importedBusinessNotSuppressedSql(now = new Date()) {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "Business" b JOIN "User" u ON u."id" = b."ownerId"
    WHERE b."cityId" = i."cityId" AND lower(btrim(b."name")) = lower(btrim(i."name"))
      AND ${getPublicBusinessSql(now)}
  )`;
}
