import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  retrievePrice: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/account-access", () => ({
  syncEffectiveAccessPlans: vi.fn(),
}));

vi.mock("@/lib/pricing", () => ({
  MEMBERSHIP_PRICE_CATALOG_KEY: "tx_localist_membership_monthly",
  MEMBERSHIP_PRODUCT_CATALOG_KEY: "tx_localist_membership",
  retrieveAndValidateStripePrice: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getSiteUrl: vi.fn(() => "http://localhost:3000"),
  getStripe: vi.fn(() => ({
    prices: { retrieve: mocks.retrievePrice },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/subscription-period", () => ({
  getStripeSubscriptionPeriodEnd: vi.fn(() => null),
}));

import { findPlanForStripeSubscription } from "@/lib/billing";

function subscriptionPrice(overrides = {}) {
  return {
    items: {
      data: [{
        price: {
          id: "price_incoming",
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

function starterPlan(overrides = {}) {
  return {
    id: "plan_starter",
    slug: "starter",
    stripePriceId: "price_configured",
    priceCents: 1000,
    billingPeriod: "monthly",
    ...overrides,
  };
}

function configuredPrice(overrides = {}) {
  return subscriptionPrice({
    id: "price_configured",
    ...overrides,
  }).items.data[0].price;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue(null);
  mocks.findUnique.mockResolvedValue(starterPlan());
  mocks.retrievePrice.mockResolvedValue(configuredPrice());
});

describe("Stripe subscription plan mapping", () => {
  test("rejects an exact configured $0 subscription before looking up a plan", async () => {
    await expect(findPlanForStripeSubscription(
      subscriptionPrice({ unit_amount: 0 }),
      "price_free",
    )).resolves.toBeNull();

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  test("accepts an exact match only when the local plan is Starter", async () => {
    mocks.findFirst.mockResolvedValue(starterPlan());

    await expect(findPlanForStripeSubscription(
      subscriptionPrice(),
      "price_incoming",
    )).resolves.toEqual({ id: "plan_starter" });

    mocks.findFirst.mockResolvedValue(starterPlan({ priceCents: 0 }));
    await expect(findPlanForStripeSubscription(
      subscriptionPrice(),
      "price_incoming",
    )).resolves.toBeNull();
  });

  test("accepts a compatible historical Price on the configured Product", async () => {
    await expect(findPlanForStripeSubscription(
      subscriptionPrice({ id: "price_historical" }),
      "price_historical",
    )).resolves.toEqual({ id: "plan_starter" });
  });

  test("rejects fallback when the configured Starter Price is free", async () => {
    mocks.retrievePrice.mockResolvedValue(configuredPrice({ unit_amount: 0 }));

    await expect(findPlanForStripeSubscription(
      subscriptionPrice({ id: "price_historical" }),
      "price_historical",
    )).resolves.toBeNull();
  });
});
