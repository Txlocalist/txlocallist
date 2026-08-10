import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertEventCheckoutSession } from "@/lib/event-checkout-validation";

function makePayment(overrides = {}) {
  return {
    id: "event_payment_1",
    eventId: "event_1",
    userId: "user_1",
    stripeCustomerId: "cus_event_1",
    stripePriceId: "price_event_post",
    amountCents: 1000,
    currency: "usd",
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: "cs_test_event",
    mode: "payment",
    customer: { id: "cus_event_1" },
    metadata: {
      scope: "event_post",
      eventId: "event_1",
      paymentId: "event_payment_1",
      userId: "user_1",
    },
    client_reference_id: "user_1",
    line_items: {
      data: [{ price: { id: "price_event_post" }, quantity: 1 }],
    },
    amount_total: 1000,
    currency: "usd",
    payment_status: "paid",
    payment_intent: { id: "pi_event_1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_EVENT_POST", "price_event_post");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertEventCheckoutSession", () => {
  test("accepts a paid session that exactly matches its event payment", () => {
    expect(assertEventCheckoutSession(makeSession(), makePayment())).toEqual({
      paymentIntentId: "pi_event_1",
    });
  });

  test("accepts an open-session price after the configured Price rotates", () => {
    vi.stubEnv("STRIPE_PRICE_EVENT_POST", "price_new_event_post");

    expect(assertEventCheckoutSession(makeSession(), makePayment())).toEqual({
      paymentIntentId: "pi_event_1",
    });
  });

  test("rejects a session for the wrong user", () => {
    const session = makeSession({
      metadata: {
        ...makeSession().metadata,
        userId: "user_2",
      },
    });

    expect(() => assertEventCheckoutSession(session, makePayment())).toThrow(
      "Stripe Checkout ownership metadata did not match this event payment."
    );
  });

  test("rejects the wrong price", () => {
    const session = makeSession({
      line_items: { data: [{ price: "price_other", quantity: 1 }] },
    });

    expect(() => assertEventCheckoutSession(session, makePayment())).toThrow(
      "Stripe Checkout line items did not match the event-posting price."
    );
  });

  test("rejects the wrong amount", () => {
    expect(() => assertEventCheckoutSession(
      makeSession({ amount_total: 999 }),
      makePayment()
    )).toThrow("Stripe Checkout total did not match the event-posting price.");
  });

  test("rejects the wrong currency", () => {
    expect(() => assertEventCheckoutSession(
      makeSession({ currency: "eur" }),
      makePayment()
    )).toThrow("Stripe Checkout total did not match the event-posting price.");
  });

  test("rejects an unpaid session", () => {
    expect(() => assertEventCheckoutSession(
      makeSession({ payment_status: "unpaid" }),
      makePayment()
    )).toThrow("Stripe has not confirmed payment for this event post.");
  });
});
