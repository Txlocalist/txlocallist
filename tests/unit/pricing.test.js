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
    const price = makePrice({
      recurring: { interval: "month", interval_count: 1 },
      livemode: true,
    });

    expect(validateStripePriceObject(price, {
      amountCents: 1000,
      currency: "usd",
      recurring: true,
    })).toBe(price);
  });

  test.each([
    ["weekly", { interval: "week", interval_count: 1 }],
    ["annual", { interval: "year", interval_count: 1 }],
    ["every two months", { interval: "month", interval_count: 2 }],
  ])("rejects a %s recurring membership Price", (_label, recurring) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");

    expect(() => validateStripePriceObject(makePrice({ recurring }), {
      amountCents: 1000,
      currency: "usd",
      recurring: true,
      recurringInterval: "month",
      recurringIntervalCount: 1,
    })).toThrow("wrong recurring interval");
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
  function configureSafeEventEnvironment() {
    vi.stubEnv("TX_LOCALIST_ENV", "test");
    vi.stubEnv("TX_LOCALIST_DATABASE_ENV", "test");
    vi.stubEnv("EVENT_POSTING_ENABLED", "true");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PK", "pk_test_example");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_example");
    vi.stubEnv("STRIPE_PRICE_EVENT_POST", "price_event");
  }

  test("requires an explicit true value and isolated services", () => {
    vi.stubEnv("EVENT_POSTING_ENABLED", "false");
    expect(isEventPostingEnabled()).toBe(false);

    configureSafeEventEnvironment();
    expect(isEventPostingEnabled()).toBe(true);
  });

  test("is case-insensitive and trims whitespace", () => {
    configureSafeEventEnvironment();
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

  test("validates Price and Product catalog metadata", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    const price = makePrice({
      metadata: { catalogKey: "tx_localist_event_post" },
      product: {
        active: true,
        metadata: { catalogKey: "tx_localist_event_post" },
      },
    });

    expect(validateStripePriceObject(price, {
      amountCents: 1000,
      currency: "usd",
      recurring: false,
      priceCatalogKey: "tx_localist_event_post",
      productCatalogKey: "tx_localist_event_post",
    })).toBe(price);
    expect(() => validateStripePriceObject(
      { ...price, metadata: { catalogKey: "wrong" } },
      {
        amountCents: 1000,
        currency: "usd",
        recurring: false,
        priceCatalogKey: "tx_localist_event_post",
      },
    )).toThrow("wrong catalog metadata");
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
