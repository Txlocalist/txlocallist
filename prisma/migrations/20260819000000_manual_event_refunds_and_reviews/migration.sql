ALTER TYPE "EventPaymentStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';

CREATE TYPE "EventReviewDecision" AS ENUM ('APPROVED', 'DENIED');

ALTER TABLE "EventPayment"
ADD COLUMN "chargedAmountCents" INTEGER,
ADD COLUMN "taxAmountCents" INTEGER,
ADD COLUMN "refundApprovedById" TEXT,
ADD COLUMN "refundApprovedAt" TIMESTAMP(3),
ADD COLUMN "refundReason" TEXT;

UPDATE "EventPayment"
SET
  "chargedAmountCents" = "amountCents",
  "taxAmountCents" = 0
WHERE "chargedAmountCents" IS NULL;

CREATE TABLE "EventReview" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "decision" "EventReviewDecision" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventReview_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EventReview" (
  "id",
  "eventId",
  "reviewerId",
  "decision",
  "comment",
  "createdAt"
)
SELECT
  CONCAT('legacy_denial_', "id"),
  "id",
  NULL,
  'DENIED'::"EventReviewDecision",
  'Legacy denial recorded before review history was available.',
  "updatedAt"
FROM "Event"
WHERE "status" = 'DENIED';

ALTER TABLE "EventReview"
ADD CONSTRAINT "EventReview_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventReview"
ADD CONSTRAINT "EventReview_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventPayment"
ADD CONSTRAINT "EventPayment_refundApprovedById_fkey"
FOREIGN KEY ("refundApprovedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EventReview_eventId_createdAt_idx"
ON "EventReview"("eventId", "createdAt");

CREATE INDEX "EventReview_reviewerId_idx"
ON "EventReview"("reviewerId");

CREATE INDEX "EventPayment_refundApprovedById_idx"
ON "EventPayment"("refundApprovedById");
