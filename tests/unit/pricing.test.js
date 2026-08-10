import { afterEach, describe, expect, test, vi } from "vitest";

import {
  EVENT_POST_CHECKOUT_DISCLOSURE,
  EVENT_POST_REFUND_DISCLOSURE,
  EVENT_POST_REVIEW_DISCLOSURE,
  EVENT_POST_TAX_DISCLOSURE,
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

describe("event posting payment disclosure", () => {
  test("states the fee, review, refund, cancellation, and tax rules", () => {
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("one-time $10 event fee");
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("before admin review");
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("does not guarantee publication");
    expect(EVENT_POST_REFUND_DISCLOSURE).toContain("denied by an admin");
    expect(EVENT_POST_REFUND_DISCLOSURE).toContain("duplicate charges");
    expect(EVENT_POST_REFUND_DISCLOSURE).toContain(
      "Organizer cancellations are not automatically refunded",
    );
    expect(EVENT_POST_TAX_DISCLOSURE).toBe(
      "Tax is not automatically calculated or collected in Checkout.",
    );
    expect(EVENT_POST_CHECKOUT_DISCLOSURE.length).toBeLessThanOrEqual(1200);
  });
});
