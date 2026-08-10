export function getStripeSubscriptionPeriodEnd(stripeSubscription) {
  const itemPeriodEnds = (stripeSubscription?.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));
  const periodEnd = itemPeriodEnds.length > 0
    ? Math.max(...itemPeriodEnds)
    : stripeSubscription?.current_period_end;

  return Number.isFinite(periodEnd) ? new Date(periodEnd * 1000) : null;
}
