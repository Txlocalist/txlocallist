import { describe, expect, test } from "vitest";

import {
  getStripePriceIdFromSubscription,
  getStripeProductIdFromSubscription,
  isCompatibleStarterPlan,
  isCompatibleStarterPrice,
  isCompatibleStarterSubscriptionPrice,
} from "@/lib/stripe-subscription-price";

function subscriptionWithPrice(overrides = {}) {
  return {
    items: {
      data: [{
        price: {
          id: "price_starter_legacy",
          active: true,
          unit_amount: 1000,
          currency: "usd",
          recurring: {
            interval: "month",
            interval_count: 1,
            usage_type: "licensed",
          },
          product: "prod_membership",
          ...overrides,
        },
      }],
    },
  };
}

describe("Stripe subscription Price compatibility", () => {
  test("accepts a legacy $10 monthly Price on the membership Product", () => {
    const subscription = subscriptionWithPrice();

    expect(isCompatibleStarterSubscriptionPrice(subscription)).toBe(true);
    expect(getStripePriceIdFromSubscription(subscription))
      .toBe("price_starter_legacy");
    expect(getStripeProductIdFromSubscription(subscription))
      .toBe("prod_membership");
  });

  test.each([
    ["free Price", { unit_amount: 0 }],
    ["annual Price", { recurring: { interval: "year", interval_count: 1 } }],
    ["non-USD Price", { currency: "eur" }],
    ["inactive Price", { active: false }],
    ["Price without an active state", { active: undefined }],
    ["metered Price", {
      recurring: {
        interval: "month",
        interval_count: 1,
        usage_type: "metered",
      },
    }],
    ["non-recurring Price", { recurring: null }],
  ])("rejects a %s from the same Product", (_label, overrides) => {
    expect(
      isCompatibleStarterSubscriptionPrice(subscriptionWithPrice(overrides)),
    ).toBe(false);
  });

  test("handles expanded Product objects and missing items", () => {
    expect(getStripeProductIdFromSubscription(subscriptionWithPrice({
      product: { id: "prod_expanded" },
    }))).toBe("prod_expanded");
    expect(isCompatibleStarterSubscriptionPrice({ items: { data: [] } }))
      .toBe(false);
  });

  test("validates direct Prices and the local Starter plan contract", () => {
    const price = subscriptionWithPrice().items.data[0].price;

    expect(isCompatibleStarterPrice(price)).toBe(true);
    expect(isCompatibleStarterPlan({
      slug: "starter",
      priceCents: 1000,
      billingPeriod: "monthly",
    })).toBe(true);
    expect(isCompatibleStarterPlan({
      slug: "starter",
      priceCents: 0,
      billingPeriod: "monthly",
    })).toBe(false);
  });
});
