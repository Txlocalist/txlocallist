import { afterEach, describe, expect, test, vi } from "vitest";

import {
  isEventPostingEnabled,
  validateStripePriceObject,
} from "@/lib/pricing";

function makePrice(overrides = {}) {
  return {
    active: true,
    unit_amount: 1000,
    currency: "usd",
    recurring: null,
    livemode: false,
    product: { active: true },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateStripePriceObject", () => {
  test("accepts the configured $10 one-time test price", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    const price = makePrice();

    expect(validateStripePriceObject(price, {
      amountCents: 1000,
      currency: "usd",
      recurring: false,
    })).toBe(price);
  });

  test("accepts a matching recurring live price", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_example");
    const price = makePrice({ recurring: { interval: "month" }, livemode: true });

    expect(validateStripePriceObject(price, {
      amountCents: 1000,
      currency: "usd",
      recurring: true,
    })).toBe(price);
  });

  test.each([
    ["inactive price", { active: false }],
    ["wrong amount", { unit_amount: 999 }],
    ["wrong currency", { currency: "eur" }],
    ["wrong billing type", { recurring: { interval: "month" } }],
    ["wrong Stripe mode", { livemode: true }],
    ["inactive product", { product: { active: false } }],
  ])("rejects an %s", (_label, overrides) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");

    expect(() => validateStripePriceObject(makePrice(overrides), {
      amountCents: 1000,
      currency: "usd",
      recurring: false,
    })).toThrow();
  });
});

describe("isEventPostingEnabled", () => {
  test("requires an explicit true value", () => {
    vi.stubEnv("EVENT_POSTING_ENABLED", "false");
    expect(isEventPostingEnabled()).toBe(false);

    vi.stubEnv("EVENT_POSTING_ENABLED", "true");
    expect(isEventPostingEnabled()).toBe(true);
  });

  test("is case-insensitive and trims whitespace", () => {
    vi.stubEnv("EVENT_POSTING_ENABLED", "  TRUE  ");
    expect(isEventPostingEnabled()).toBe(true);
  });
});
