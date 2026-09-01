const STARTER_PRICE_CENTS = 1000;
const STARTER_CURRENCY = "usd";
const STARTER_BILLING_PERIOD = "monthly";

export function getPrimarySubscriptionPrice(stripeSubscription) {
  return stripeSubscription?.items?.data?.[0]?.price ?? null;
}

export function getStripePriceIdFromSubscription(stripeSubscription) {
  return getPrimarySubscriptionPrice(stripeSubscription)?.id ?? null;
}

export function getStripeProductIdFromSubscription(stripeSubscription) {
  const product = getPrimarySubscriptionPrice(stripeSubscription)?.product;
  if (!product) return null;
  return typeof product === "string" ? product : product.id;
}

export function isCompatibleStarterPrice(price) {
  return Boolean(
    price &&
    price.active === true &&
    price.unit_amount === STARTER_PRICE_CENTS &&
    price.currency?.toLowerCase() === STARTER_CURRENCY &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed"
  );
}

export function isCompatibleStarterPlan(plan) {
  return Boolean(
    plan &&
    plan.slug === "starter" &&
    plan.priceCents === STARTER_PRICE_CENTS &&
    plan.billingPeriod === STARTER_BILLING_PERIOD
  );
}

export function isCompatibleStarterSubscriptionPrice(stripeSubscription) {
  return isCompatibleStarterPrice(getPrimarySubscriptionPrice(stripeSubscription));
}
