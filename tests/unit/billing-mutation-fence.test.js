import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingMutationFence: {
      create: mocks.create,
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
    },
  },
}));

import {
  acquireBillingMutationFence,
  attachStripeSessionToFence,
  BILLING_MUTATION_KIND,
  claimRoleTransitionFence,
  releaseFenceFromStripeSession,
} from "@/lib/billing-mutation-fence";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BILLING_MUTATION_FENCE_ENABLED", "true");
  mocks.create.mockResolvedValue({ userId: "user_1" });
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("billing mutation fence", () => {
  test("removes only an expired owner before acquiring the unique user fence", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await acquireBillingMutationFence({
      userId: "user_1",
      kind: BILLING_MUTATION_KIND.CHECKOUT,
      operationKey: "checkout_1",
      expiresAt,
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        expiresAt: { lte: expect.any(Date) },
      },
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        kind: "SUBSCRIPTION_CHECKOUT",
        operationKey: "checkout_1",
        expiresAt,
      },
    });
  });

  test("fails closed when another mutation owns the user fence", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    await expect(acquireBillingMutationFence({
      userId: "user_1",
      kind: BILLING_MUTATION_KIND.CHECKOUT,
      operationKey: "checkout_2",
      expiresAt: new Date(Date.now() + 60_000),
    })).rejects.toMatchObject({ code: "BILLING_MUTATION_IN_PROGRESS" });
  });

  test("promotes an existing role preview to a non-expiring recovery fence", async () => {
    await claimRoleTransitionFence({ userId: "user_1", operationId: "role_1" });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        operationKey: "complimentary-role:role_1",
      },
      data: { expiresAt: null },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("requires the exact Stripe session metadata before releasing", async () => {
    await releaseFenceFromStripeSession({
      id: "cs_1",
      metadata: {
        ownerId: "user_1",
        billingMutationKey: "checkout_1",
      },
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        operationKey: "checkout_1",
        stripeSessionId: "cs_1",
      },
    });
  });

  test("detects a lost lease before attaching the Stripe session", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(attachStripeSessionToFence({
      userId: "user_1",
      operationKey: "checkout_1",
      stripeSessionId: "cs_1",
      expiresAt: new Date(Date.now() + 60_000),
    })).rejects.toMatchObject({ code: "BILLING_MUTATION_FENCE_LOST" });
  });
});
