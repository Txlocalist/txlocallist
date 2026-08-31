-- This is intentionally a coordinated maintenance migration. Older application
-- instances do not understand the new role values and must not run concurrently.

-- Preserve a per-user audit trail before OWNER is removed from the enum.
INSERT INTO "AuditLog" ("id", "actorId", "action", "entity", "entityId", "meta", "createdAt")
SELECT
  CONCAT('role-migration-owner-to-user-', "id"),
  NULL,
  'ROLE_MIGRATION_OWNER_TO_USER',
  'User',
  "id",
  '{"fromRole":"OWNER","toRole":"USER"}',
  CURRENT_TIMESTAMP
FROM "User"
WHERE "role" = 'OWNER'
ON CONFLICT ("id") DO NOTHING;

CREATE TYPE "Role_new" AS ENUM ('USER', 'COMPLIMENTARY', 'MANAGER', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text = 'OWNER' THEN 'USER'
      ELSE "role"::text
    END
  )::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "roleVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "RoleTransitionStatus" AS ENUM (
  'PREVIEWED',
  'PROCESSING',
  'PARTIAL',
  'STRIPE_VERIFIED',
  'COMPLETED',
  'NEEDS_ATTENTION',
  'EXPIRED'
);

CREATE TYPE "RoleTransitionSubscriptionResult" AS ENUM (
  'PENDING',
  'ALREADY_SCHEDULED',
  'SCHEDULED',
  'TERMINAL',
  'FAILED',
  'AMBIGUOUS'
);

CREATE TABLE "RoleTransitionOperation" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "fromRole" "Role" NOT NULL,
  "toRole" "Role" NOT NULL,
  "targetRoleVersion" INTEGER NOT NULL,
  "status" "RoleTransitionStatus" NOT NULL DEFAULT 'PREVIEWED',
  "activeTargetKey" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleTransitionOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleTransitionSubscription" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "sources" TEXT NOT NULL DEFAULT '[]',
  "stripeStatus" TEXT NOT NULL,
  "amountCents" INTEGER,
  "currency" TEXT,
  "priorCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodEnd" TIMESTAMP(3),
  "result" "RoleTransitionSubscriptionResult" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "stripeRequestId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleTransitionSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleTransitionOperation_activeTargetKey_key"
  ON "RoleTransitionOperation"("activeTargetKey");
CREATE INDEX "RoleTransitionOperation_actorId_createdAt_idx"
  ON "RoleTransitionOperation"("actorId", "createdAt");
CREATE INDEX "RoleTransitionOperation_targetUserId_createdAt_idx"
  ON "RoleTransitionOperation"("targetUserId", "createdAt");
CREATE INDEX "RoleTransitionOperation_status_expiresAt_idx"
  ON "RoleTransitionOperation"("status", "expiresAt");

CREATE UNIQUE INDEX "RoleTransitionSubscription_operationId_stripeSubscriptionId_key"
  ON "RoleTransitionSubscription"("operationId", "stripeSubscriptionId");
CREATE INDEX "RoleTransitionSubscription_stripeSubscriptionId_idx"
  ON "RoleTransitionSubscription"("stripeSubscriptionId");
CREATE INDEX "RoleTransitionSubscription_result_idx"
  ON "RoleTransitionSubscription"("result");

ALTER TABLE "RoleTransitionOperation"
  ADD CONSTRAINT "RoleTransitionOperation_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleTransitionOperation"
  ADD CONSTRAINT "RoleTransitionOperation_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleTransitionSubscription"
  ADD CONSTRAINT "RoleTransitionSubscription_operationId_fkey"
  FOREIGN KEY ("operationId") REFERENCES "RoleTransitionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
