-- Keep Stripe's refund lifecycle distinct from local operational failures so
-- out-of-order webhook deliveries cannot regress a terminal Stripe refund.
ALTER TABLE "EventPayment"
ADD COLUMN "stripeRefundStatus" TEXT;
