import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrieveCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mocks.updateUser },
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
    customers: {
      retrieve: mocks.retrieveCustomer,
      create: mocks.createCustomer,
    },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/subscription-period", () => ({
  getStripeSubscriptionPeriodEnd: vi.fn(() => null),
}));

import { ensureStripeCustomerForUser } from "@/lib/billing";

const user = {
  id: "user_1",
  email: "sandbox@example.test",
  name: "Sandbox User",
  stripeCustomerId: "cus_stale",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TX_LOCALIST_ENV", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_sandbox");
  mocks.retrieveCustomer.mockResolvedValue({
    id: "cus_stale",
    deleted: false,
    metadata: { userId: user.id },
  });
  mocks.createCustomer.mockResolvedValue({ id: "cus_replacement" });
  mocks.updateUser.mockResolvedValue({ id: user.id });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ensureStripeCustomerForUser", () => {
  test("reuses a verified Customer", async () => {
    await expect(ensureStripeCustomerForUser(user)).resolves.toBe("cus_stale");

    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("creates and stores a replacement when Stripe reports it missing", async () => {
    mocks.retrieveCustomer.mockRejectedValue(Object.assign(
      new Error("No such customer"),
      { code: "resource_missing" },
    ));

    await expect(ensureStripeCustomerForUser(user))
      .resolves.toBe("cus_replacement");
    expect(mocks.createCustomer).toHaveBeenCalledWith({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { stripeCustomerId: "cus_replacement" },
    });
  });

  test("creates a replacement for a deleted Customer", async () => {
    mocks.retrieveCustomer.mockResolvedValue({ id: "cus_stale", deleted: true });

    await expect(ensureStripeCustomerForUser(user))
      .resolves.toBe("cus_replacement");
  });

  test("fails closed when Stripe metadata names another user", async () => {
    mocks.retrieveCustomer.mockResolvedValue({
      id: "cus_stale",
      deleted: false,
      metadata: { userId: "user_other" },
    });

    await expect(ensureStripeCustomerForUser(user))
      .rejects.toThrow(/belongs to another account/i);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  test("does not create a duplicate for a non-missing Stripe error", async () => {
    const outage = Object.assign(new Error("Stripe unavailable"), {
      code: "api_connection_error",
    });
    mocks.retrieveCustomer.mockRejectedValue(outage);

    await expect(ensureStripeCustomerForUser(user)).rejects.toBe(outage);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });

  test("does not repair a missing Customer in production", async () => {
    vi.stubEnv("TX_LOCALIST_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_production");
    const missing = Object.assign(new Error("No such customer"), {
      code: "resource_missing",
    });
    mocks.retrieveCustomer.mockRejectedValue(missing);

    await expect(ensureStripeCustomerForUser(user)).rejects.toBe(missing);
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });
});
