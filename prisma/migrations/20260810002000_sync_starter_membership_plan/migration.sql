-- Keep the database amount used to validate subscription Checkout aligned with
-- the approved $10/month Starter catalog price. The Stripe Price ID is synced
-- after catalog setup by scripts/seed-plans.mjs because it is environment-specific.
UPDATE "Plan"
SET
    "name" = 'Local Business Membership',
    "tier" = 1,
    "priceCents" = 1000,
    "billingPeriod" = 'monthly',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter';
