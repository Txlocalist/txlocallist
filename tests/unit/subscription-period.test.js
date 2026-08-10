import { describe, expect, test } from "vitest";

import { getStripeSubscriptionPeriodEnd } from "@/lib/subscription-period";

describe("getStripeSubscriptionPeriodEnd", () => {
  test("uses Basil item-level current_period_end", () => {
    const periodEnd = 1_800_000_000;

    expect(getStripeSubscriptionPeriodEnd({
      items: { data: [{ current_period_end: periodEnd }] },
    })).toEqual(new Date(periodEnd * 1000));
  });

  test("uses the latest item period for a multi-item subscription", () => {
    expect(getStripeSubscriptionPeriodEnd({
      items: {
        data: [
          { current_period_end: 1_800_000_000 },
          { current_period_end: 1_900_000_000 },
        ],
      },
      current_period_end: 1_700_000_000,
    })).toEqual(new Date(1_900_000_000 * 1000));
  });

  test("falls back to the legacy top-level field and otherwise returns null", () => {
    expect(getStripeSubscriptionPeriodEnd({
      current_period_end: 1_700_000_000,
    })).toEqual(new Date(1_700_000_000 * 1000));
    expect(getStripeSubscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
    expect(getStripeSubscriptionPeriodEnd(null)).toBeNull();
  });
});
