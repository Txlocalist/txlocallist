-- One-time event posting, payment audit, and webhook idempotency.
-- This migration is additive so it can safely baseline the database that was
-- previously managed by the numbered SQL files in this repository.

DO $$ BEGIN
  CREATE TYPE "EventPostingMethod" AS ENUM ('LEGACY', 'SUBSCRIPTION', 'ONE_TIME', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventPaymentStatus" AS ENUM (
    'CREATED',
    'PROCESSING',
    'PAID',
    'FAILED',
    'EXPIRED',
    'REFUND_PENDING',
    'REFUNDED',
    'REFUND_FAILED',
    'DISPUTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS "eventUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "postingMethod" "EventPostingMethod" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EventPayment" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "EventPaymentStatus" NOT NULL DEFAULT 'CREATED',
  "stripePriceId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "stripeRefundId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "checkoutExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventPayment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventPayment_stripeCheckoutSessionId_key" ON "EventPayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventPayment_stripePaymentIntentId_key" ON "EventPayment"("stripePaymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventPayment_stripeRefundId_key" ON "EventPayment"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "EventPayment_eventId_status_idx" ON "EventPayment"("eventId", "status");
CREATE INDEX IF NOT EXISTS "EventPayment_userId_createdAt_idx" ON "EventPayment"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EventPayment_stripePriceId_idx" ON "EventPayment"("stripePriceId");

CREATE TABLE IF NOT EXISTS "EventImageUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT,
  "url" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  CONSTRAINT "EventImageUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventImageUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventImageUpload_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventImageUpload_url_key" ON "EventImageUpload"("url");
CREATE UNIQUE INDEX IF NOT EXISTS "EventImageUpload_pathname_key" ON "EventImageUpload"("pathname");
CREATE INDEX IF NOT EXISTS "EventImageUpload_userId_createdAt_idx" ON "EventImageUpload"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EventImageUpload_eventId_idx" ON "EventImageUpload"("eventId");

CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");
CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_processingStartedAt_idx" ON "StripeWebhookEvent"("processingStartedAt");
CREATE INDEX IF NOT EXISTS "Event_status_endDate_idx" ON "Event"("status", "endDate");
CREATE INDEX IF NOT EXISTS "Event_postingMethod_idx" ON "Event"("postingMethod");

-- Repair the Like table expected by the checked-in Prisma schema. The deployed
-- database predates the latest flat SQL file, and Next builds currently log
-- that this relation is missing.
CREATE TABLE IF NOT EXISTS "Like" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Like_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Like_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_businessId_key" ON "Like"("userId", "businessId");
CREATE INDEX IF NOT EXISTS "Like_userId_idx" ON "Like"("userId");
CREATE INDEX IF NOT EXISTS "Like_businessId_idx" ON "Like"("businessId");

CREATE TABLE IF NOT EXISTS "EventFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventFavorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventFavorite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventFavorite_userId_eventId_key" ON "EventFavorite"("userId", "eventId");
CREATE INDEX IF NOT EXISTS "EventFavorite_userId_idx" ON "EventFavorite"("userId");
CREATE INDEX IF NOT EXISTS "EventFavorite_eventId_idx" ON "EventFavorite"("eventId");
