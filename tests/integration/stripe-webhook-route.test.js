import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const handlers = vi.hoisted(() => ({
  handleStripeSubscriptionWebhook: vi.fn(),
  syncSubscriptionFromCheckoutSessionId: vi.fn(),
  handleEventChargeDispute: vi.fn(),
  handleEventChargeDisputeClosed: vi.fn(),
  handleEventChargeRefunded: vi.fn(),
  handleEventCheckoutSessionFailure: vi.fn(),
  handleEventCheckoutSessionProcessing: vi.fn(),
  handleEventRefundUpdated: vi.fn(),
  syncEventPaymentFromCheckoutSession: vi.fn(),
  processStripeWebhookOnce: vi.fn(),
}));

vi.mock("@/lib/billing", () => ({
  handleStripeSubscriptionWebhook: handlers.handleStripeSubscriptionWebhook,
  syncSubscriptionFromCheckoutSessionId:
    handlers.syncSubscriptionFromCheckoutSessionId,
}));

vi.mock("@/lib/event-payments", () => ({
  handleEventChargeDispute: handlers.handleEventChargeDispute,
  handleEventChargeDisputeClosed: handlers.handleEventChargeDisputeClosed,
  handleEventChargeRefunded: handlers.handleEventChargeRefunded,
  handleEventCheckoutSessionFailure: handlers.handleEventCheckoutSessionFailure,
  handleEventCheckoutSessionProcessing:
    handlers.handleEventCheckoutSessionProcessing,
  handleEventRefundUpdated: handlers.handleEventRefundUpdated,
  syncEventPaymentFromCheckoutSession:
    handlers.syncEventPaymentFromCheckoutSession,
}));

vi.mock("@/lib/event-disputes", () => ({
  isTerminalEventDisputeStatus: vi.fn(() => false),
}));

vi.mock("@/lib/stripe-webhooks", () => ({
  processStripeWebhookOnce: handlers.processStripeWebhookOnce,
}));

import { POST } from "@/app/api/stripe/webhook/route";

const webhookSecret = "whsec_route_test_secret";
const stripe = new Stripe("sk_test_route_test_key");

function stripeEvent(type, object, id = `evt_${type.replaceAll(".", "_")}`) {
  return {
    id,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object },
  };
}

function requestFor(event, { signature = true } = {}) {
  const payload = JSON.stringify(event);
  const headers = { "content-type": "application/json" };
  if (signature) {
    headers["stripe-signature"] = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
  }

  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers,
    body: payload,
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_route_test_key");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
  handlers.processStripeWebhookOnce.mockImplementation(async (event, handler) => {
    await handler(event);
    return { handled: true, duplicate: false, inProgress: false };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/stripe/webhook", () => {
  test("fails closed when the signing secret is absent", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await POST(requestFor(stripeEvent("test.event", {})));

    expect(response.status).toBe(503);
    expect(handlers.processStripeWebhookOnce).not.toHaveBeenCalled();
  });

  test("rejects a missing or invalid Stripe signature", async () => {
    const missing = await POST(
      requestFor(stripeEvent("test.event", {}), { signature: false }),
    );
    const invalid = await POST(new Request(
      "http://localhost:3000/api/stripe/webhook",
      {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: JSON.stringify(stripeEvent("test.event", {})),
      },
    ));

    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(handlers.processStripeWebhookOnce).not.toHaveBeenCalled();
  });

  test("verifies and routes a paid event Checkout session", async () => {
    const event = stripeEvent("checkout.session.completed", {
      id: "cs_test_event_paid",
      payment_status: "paid",
      metadata: { scope: "event_post" },
    });

    const response = await POST(requestFor(event));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: false });
    expect(handlers.syncEventPaymentFromCheckoutSession)
      .toHaveBeenCalledWith("cs_test_event_paid");
    expect(handlers.processStripeWebhookOnce).toHaveBeenCalledWith(
      expect.objectContaining({ id: event.id, type: event.type }),
      expect.any(Function),
    );
  });

  test("routes account Checkout and subscription lifecycle events", async () => {
    await POST(requestFor(stripeEvent("checkout.session.completed", {
      id: "cs_test_account",
      payment_status: "paid",
      metadata: { scope: "account" },
    })));
    const subscriptionEvent = stripeEvent("customer.subscription.updated", {
      id: "sub_test_updated",
      status: "past_due",
    });
    await POST(requestFor(subscriptionEvent));

    expect(handlers.syncSubscriptionFromCheckoutSessionId)
      .toHaveBeenCalledWith("cs_test_account");
    expect(handlers.handleStripeSubscriptionWebhook)
      .toHaveBeenCalledWith(subscriptionEvent.data.object, subscriptionEvent.id);
  });

  test("returns a retryable conflict while another delivery owns the lease", async () => {
    handlers.processStripeWebhookOnce.mockResolvedValueOnce({
      handled: false,
      duplicate: false,
      inProgress: true,
    });

    const response = await POST(requestFor(stripeEvent("test.event", {})));

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  test("returns 500 so Stripe retries a failed handler", async () => {
    handlers.processStripeWebhookOnce.mockRejectedValueOnce(
      new Error("temporary database failure"),
    );

    const response = await POST(requestFor(stripeEvent("test.event", {})));

    expect(response.status).toBe(500);
  });
});
