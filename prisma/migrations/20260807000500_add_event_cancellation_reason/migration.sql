CREATE TYPE "EventCancellationReason" AS ENUM (
  'ORGANIZER',
  'ADMIN',
  'PAYMENT_REFUND',
  'PAYMENT_DISPUTE'
);

ALTER TABLE "Event"
ADD COLUMN "cancellationReason" "EventCancellationReason";
