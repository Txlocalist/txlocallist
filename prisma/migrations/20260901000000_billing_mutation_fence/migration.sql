-- A single durable owner serializes account-level Stripe mutations with
-- Complimentary role transitions. A null expiry is reserved for transitions
-- that may already have Stripe side effects and require Admin recovery.
CREATE TYPE "BillingMutationKind" AS ENUM (
  'SUBSCRIPTION_CHECKOUT',
  'BILLING_PORTAL',
  'COMPLIMENTARY_ROLE'
);

CREATE TABLE "BillingMutationFence" (
  "userId" TEXT NOT NULL,
  "kind" "BillingMutationKind" NOT NULL,
  "operationKey" TEXT NOT NULL,
  "stripeSessionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingMutationFence_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "BillingMutationFence_operationKey_key"
  ON "BillingMutationFence"("operationKey");

CREATE UNIQUE INDEX "BillingMutationFence_stripeSessionId_key"
  ON "BillingMutationFence"("stripeSessionId");

CREATE INDEX "BillingMutationFence_expiresAt_idx"
  ON "BillingMutationFence"("expiresAt");

ALTER TABLE "BillingMutationFence"
  ADD CONSTRAINT "BillingMutationFence_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
