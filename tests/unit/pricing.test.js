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

  test("validates exclusive tax and the event product tax code", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    const price = makePrice({
      tax_behavior: "exclusive",
      product: { active: true, tax_code: "txcd_10701000" },
    });

    expect(validateStripePriceObject(price, {
      amountCents: 1000,
      currency: "usd",
      recurring: false,
      taxBehavior: "exclusive",
      productTaxCode: "txcd_10701000",
    })).toBe(price);
    expect(() => validateStripePriceObject(
      { ...price, tax_behavior: "inclusive" },
      {
        amountCents: 1000,
        currency: "usd",
        recurring: false,
        taxBehavior: "exclusive",
        productTaxCode: "txcd_10701000",
      },
    )).toThrow("wrong tax behavior");
  });
});

describe("event posting payment disclosure", () => {
  test("states the fee, review, refund, cancellation, and tax rules", () => {
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("one-time $10 event subtotal");
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("before admin review");
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("does not guarantee publication");
    expect(EVENT_POST_REVIEW_DISCLOSURE).toContain("resubmitted without another event fee");
    expect(EVENT_POST_REFUND_DISCLOSURE).toContain("Refunds are never automatic");
    expect(EVENT_POST_REFUND_DISCLOSURE).toContain("only an administrator");
    expect(EVENT_POST_TAX_DISCLOSURE).toContain("Texas sales tax");
    expect(EVENT_POST_TAX_DISCLOSURE).toContain("added to the $10 subtotal");
    expect(EVENT_POST_CHECKOUT_DISCLOSURE.length).toBeLessThanOrEqual(1200);
  });
});
