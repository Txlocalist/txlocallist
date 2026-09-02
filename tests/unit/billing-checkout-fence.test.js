import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const billingMutationFence = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  };
  const prisma = {
    billingMutationFence,
    user: { update: vi.fn(), updateMany: vi.fn() },
    subscription: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const stripe = {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    checkout: { sessions: { create: vi.fn(), expire: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  };
  return { prisma, stripe, validatePrice: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/account-access", () => ({ syncEffectiveAccessPlans: vi.fn() }));
vi.mock("@/lib/pricing", () => ({
  MEMBERSHIP_PRICE_CATALOG_KEY: "tx_localist_membership_monthly",
  MEMBERSHIP_PRODUCT_CATALOG_KEY: "tx_localist_membership",
  retrieveAndValidateStripePrice: mocks.validatePrice,
}));
vi.mock("@/lib/stripe", () => ({
  getSiteUrl: vi.fn(() => "https://example.test"),
  getStripe: vi.fn(() => mocks.stripe),
  isStripeConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/subscription-period", () => ({
  getStripeSubscriptionPeriodEnd: vi.fn(() => null),
}));

import {
  createStripeCheckoutSession,
  createStripePortalSession,
} from "@/lib/billing";

const user = {
  id: "user_1",
  email: "buyer@example.test",
  name: "Buyer",
  role: "USER",
  stripeCustomerId: "cus_1",
};
const plan = {
  id: "plan_1",
  name: "Starter",
  stripePriceId: "price_1",
  priceCents: 1000,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BILLING_MUTATION_FENCE_ENABLED", "true");
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.prisma));
  mocks.prisma.billingMutationFence.create.mockResolvedValue({});
  mocks.prisma.billingMutationFence.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.billingMutationFence.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.stripe.customers.retrieve.mockResolvedValue({
    id: "cus_1",
    deleted: false,
    metadata: { userId: "user_1" },
  });
  mocks.stripe.checkout.sessions.create.mockImplementation(async (params) => ({
    id: "cs_1",
    url: "https://checkout.stripe.test/cs_1",
    expires_at: params.expires_at,
    metadata: params.metadata,
  }));
  mocks.stripe.checkout.sessions.expire.mockResolvedValue({ id: "cs_1", status: "expired" });
  mocks.stripe.billingPortal.sessions.create.mockResolvedValue({
    id: "bps_1",
    url: "https://billing.stripe.test/bps_1",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("membership billing mutation fence", () => {
  test("holds Checkout ownership and binds it to Stripe metadata", async () => {
    const session = await createStripeCheckoutSession({ user, plan });

    expect(session.id).toBe("cs_1");
    expect(mocks.prisma.billingMutationFence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        kind: "SUBSCRIPTION_CHECKOUT",
      }),
    });
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: expect.any(Number),
        metadata: expect.objectContaining({
          ownerId: "user_1",
          billingMutationKey: expect.stringMatching(/^subscription-checkout:/),
        }),
        subscription_data: {
          metadata: expect.objectContaining({
            billingMutationKey: expect.stringMatching(/^subscription-checkout:/),
          }),
        },
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^subscription-checkout:/),
      }),
    );
    expect(mocks.prisma.billingMutationFence.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: "user_1" }),
      data: expect.objectContaining({ stripeSessionId: "cs_1" }),
    });
  });

  test("does not call Stripe when another operation owns the account", async () => {
    mocks.prisma.billingMutationFence.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    await expect(createStripeCheckoutSession({ user, plan }))
      .rejects.toMatchObject({ code: "BILLING_MUTATION_IN_PROGRESS" });
    expect(mocks.stripe.customers.retrieve).not.toHaveBeenCalled();
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test("expires a created Checkout when the durable attachment is lost", async () => {
    mocks.prisma.billingMutationFence.updateMany.mockResolvedValue({ count: 0 });

    await expect(createStripeCheckoutSession({ user, plan }))
      .rejects.toMatchObject({ code: "BILLING_MUTATION_FENCE_LOST" });
    expect(mocks.stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_1");
  });

  test("serializes Billing Portal creation and releases the short operation", async () => {
    await createStripePortalSession({ user });

    expect(mocks.prisma.billingMutationFence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        kind: "BILLING_PORTAL",
      }),
    });
    expect(mocks.stripe.billingPortal.sessions.create).toHaveBeenCalledOnce();
    expect(mocks.prisma.billingMutationFence.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: "user_1" }),
    });
  });
});
