ALTER TABLE "EventPayment"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE INDEX IF NOT EXISTS "EventPayment_stripeCustomerId_idx" ON "EventPayment"("stripeCustomerId");
