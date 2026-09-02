import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    roleTransitionOperation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    roleTransitionSubscription: {
      update: vi.fn(),
    },
    billingMutationFence: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    plan: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    syncEffectiveAccessPlans: vi.fn(),
    syncSubscriptionFromCheckoutSessionId: vi.fn(),
    stripe: {
      checkout: {
        sessions: {
          list: vi.fn(),
          expire: vi.fn(),
          retrieve: vi.fn(),
        },
      },
      subscriptions: {
        list: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
      },
    },
    isStripeConfigured: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/account-access", () => ({
  ACCOUNT_ROLES: ["USER", "COMPLIMENTARY", "MANAGER", "ADMIN"],
  syncEffectiveAccessPlans: mocks.syncEffectiveAccessPlans,
}));
vi.mock("@/lib/billing", () => ({
  syncStripeSubscriptionObject: vi.fn(),
  syncSubscriptionFromCheckoutSessionId: mocks.syncSubscriptionFromCheckoutSessionId,
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => mocks.stripe),
  isStripeConfigured: mocks.isStripeConfigured,
}));

import {
  confirmRoleTransition,
  previewRoleTransition,
} from "@/lib/role-transitions";

function target(overrides = {}) {
  return {
    id: "user_target",
    email: "target@example.com",
    name: "Target",
    role: "USER",
    roleVersion: 3,
    deletedAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    ownedBusinesses: [],
    ...overrides,
  };
}

function operation(overrides = {}) {
  return {
    id: "operation_1",
    actorId: "admin_1",
    targetUserId: "user_target",
    fromRole: "USER",
    toRole: "COMPLIMENTARY",
    targetRoleVersion: 3,
    status: "PREVIEWED",
    expiresAt: new Date(Date.now() + 60_000),
    subscriptions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("COMPLIMENTARY_ROLE_MUTATIONS_ENABLED", "false");

  mocks.prisma.user.findUnique.mockResolvedValue(target());
  mocks.prisma.user.count.mockResolvedValue(2);
  mocks.prisma.user.update.mockResolvedValue({});
  mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(null);
  mocks.prisma.roleTransitionOperation.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: "operation_new",
      status: "PREVIEWED",
      ...data,
      subscriptions: [],
    }),
  );
  mocks.prisma.roleTransitionOperation.update.mockImplementation(({ where, data }) => {
    const current = operation({ id: where.id });
    return Promise.resolve({
      ...current,
      ...data,
      subscriptions: data.subscriptions?.create ?? current.subscriptions,
    });
  });
  mocks.prisma.roleTransitionOperation.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.roleTransitionSubscription.update.mockResolvedValue({});
  mocks.prisma.billingMutationFence.create.mockResolvedValue({});
  mocks.prisma.billingMutationFence.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.billingMutationFence.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.plan.findMany.mockResolvedValue([]);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.prisma));
  mocks.syncEffectiveAccessPlans.mockResolvedValue(null);
  mocks.syncSubscriptionFromCheckoutSessionId.mockResolvedValue(true);
  mocks.isStripeConfigured.mockReturnValue(false);
  mocks.stripe.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });
  mocks.stripe.checkout.sessions.expire.mockResolvedValue({ status: "expired" });
  mocks.stripe.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Complimentary role rollout guard", () => {
  it("blocks a new Complimentary preview before Stripe or a transaction", async () => {
    await expect(
      previewRoleTransition({
        actorId: "admin_1",
        targetUserId: "user_target",
        toRole: "COMPLIMENTARY",
      }),
    ).rejects.toMatchObject({ code: "COMPLIMENTARY_ROLE_MUTATIONS_DISABLED" });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("acquires the durable fence when both rollout switches are enabled", async () => {
    vi.stubEnv("BILLING_MUTATION_FENCE_ENABLED", "true");
    vi.stubEnv("COMPLIMENTARY_ROLE_MUTATIONS_ENABLED", "true");

    const preview = await previewRoleTransition({
      actorId: "admin_1",
      targetUserId: "user_target",
      toRole: "COMPLIMENTARY",
    });

    expect(preview.toRole).toBe("COMPLIMENTARY");
    expect(mocks.prisma.billingMutationFence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_target",
        kind: "COMPLIMENTARY_ROLE",
      }),
    });
    expect(mocks.prisma.billingMutationFence.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "user_target",
        operationKey: expect.stringMatching(/^complimentary-preview:/),
      }),
      data: expect.objectContaining({ operationKey: "complimentary-role:operation_new" }),
    });
  });

  it("expires open account Checkout sessions before saving the preview", async () => {
    vi.stubEnv("BILLING_MUTATION_FENCE_ENABLED", "true");
    vi.stubEnv("COMPLIMENTARY_ROLE_MUTATIONS_ENABLED", "true");
    mocks.prisma.user.findUnique.mockResolvedValue(target({ stripeCustomerId: "cus_target" }));
    mocks.isStripeConfigured.mockReturnValue(true);
    mocks.stripe.checkout.sessions.list.mockResolvedValue({
      data: [
        {
          id: "cs_open",
          status: "open",
          client_reference_id: "user_target",
          metadata: { scope: "account", ownerId: "user_target" },
        },
      ],
      has_more: false,
    });

    await previewRoleTransition({
      actorId: "admin_1",
      targetUserId: "user_target",
      toRole: "COMPLIMENTARY",
    });

    expect(mocks.stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_open");
    expect(mocks.prisma.roleTransitionOperation.create).toHaveBeenCalled();
  });

  it("allows an Admin to revoke existing Complimentary access", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(target({ role: "COMPLIMENTARY" }));

    const preview = await previewRoleTransition({
      actorId: "admin_1",
      targetUserId: "user_target",
      toRole: "USER",
    });

    expect(preview).toMatchObject({
      id: "operation_new",
      toRole: "USER",
    });
  });

  it("expires an untouched preview when the rollout switch is off", async () => {
    mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(operation());

    await expect(
      confirmRoleTransition({
        actorId: "admin_1",
        operationId: "operation_1",
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: "COMPLIMENTARY_ROLE_MUTATIONS_DISABLED" });

    expect(mocks.prisma.roleTransitionOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "EXPIRED", activeTargetKey: null }),
      }),
    );
  });

  it.each(["PROCESSING", "PARTIAL", "STRIPE_VERIFIED"])(
    "finishes an expired %s operation even after the switch is off",
    async (status) => {
      mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(
        operation({
          status,
          expiresAt: new Date(Date.now() - 60_000),
        }),
      );

      const completed = await confirmRoleTransition({
        actorId: "admin_1",
        operationId: "operation_1",
        confirmed: true,
      });

      expect(completed.status).toBe("COMPLETED");
      expect(mocks.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user_target" },
        data: { role: "COMPLIMENTARY", roleVersion: { increment: 1 } },
      });
    },
  );

  it("blocks a pristine NEEDS_ATTENTION operation after the switch is off", async () => {
    mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(
      operation({ status: "NEEDS_ATTENTION" }),
    );

    await expect(
      confirmRoleTransition({
        actorId: "admin_1",
        operationId: "operation_1",
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: "COMPLIMENTARY_ROLE_MUTATIONS_DISABLED" });
  });

  it("recovers NEEDS_ATTENTION after a recorded Stripe attempt", async () => {
    const linkedTarget = target({ stripeSubscriptionId: "sub_1" });
    const stripeSubscription = {
      id: "sub_1",
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1_800_000_000,
      metadata: { ownerId: "user_target" },
      schedule: null,
      items: {
        data: [
          {
            quantity: 1,
            price: {
              id: "price_starter",
              unit_amount: 1000,
              currency: "usd",
            },
          },
        ],
      },
    };
    mocks.prisma.user.findUnique.mockResolvedValue(linkedTarget);
    mocks.prisma.plan.findMany.mockResolvedValue([
      { stripePriceId: "price_starter" },
    ]);
    mocks.isStripeConfigured.mockReturnValue(true);
    mocks.stripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription);
    mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(
      operation({
        status: "NEEDS_ATTENTION",
        expiresAt: new Date(Date.now() - 60_000),
        subscriptions: [
          {
            id: "operation_subscription_1",
            stripeSubscriptionId: "sub_1",
            result: "FAILED",
            attemptCount: 1,
          },
        ],
      }),
    );

    const completed = await confirmRoleTransition({
      actorId: "admin_1",
      operationId: "operation_1",
      confirmed: true,
    });

    expect(completed.status).toBe("COMPLETED");
    expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalled();
  });

  it("allows a different Admin to resume an operation with Stripe side effects", async () => {
    mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(
      operation({ actorId: "admin_original", status: "STRIPE_VERIFIED" }),
    );

    const completed = await confirmRoleTransition({
      actorId: "admin_recovery",
      operationId: "operation_1",
      confirmed: true,
    });

    expect(completed.status).toBe("COMPLETED");
    expect(mocks.prisma.user.update).toHaveBeenCalled();
  });

  it("keeps a side-effecting operation recoverable when subscriptions change", async () => {
    const linkedTarget = target({ stripeSubscriptionId: "sub_new" });
    const stripeSubscription = {
      id: "sub_new",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
      metadata: { ownerId: "user_target" },
      schedule: null,
      items: { data: [{ price: { id: "price_starter", unit_amount: 1000, currency: "usd" } }] },
    };
    mocks.prisma.user.findUnique.mockResolvedValue(linkedTarget);
    mocks.prisma.plan.findMany.mockResolvedValue([{ stripePriceId: "price_starter" }]);
    mocks.isStripeConfigured.mockReturnValue(true);
    mocks.stripe.subscriptions.retrieve.mockResolvedValue(stripeSubscription);
    mocks.prisma.roleTransitionOperation.findUnique.mockResolvedValue(
      operation({ status: "PARTIAL", subscriptions: [] }),
    );

    await expect(
      confirmRoleTransition({
        actorId: "admin_recovery",
        operationId: "operation_1",
        confirmed: true,
      }),
    ).rejects.toMatchObject({ code: "SUBSCRIPTIONS_CHANGED" });

    expect(mocks.prisma.roleTransitionOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NEEDS_ATTENTION" }),
      }),
    );
    expect(mocks.prisma.billingMutationFence.deleteMany).not.toHaveBeenCalledWith({
      where: {
        userId: "user_target",
        operationKey: "complimentary-role:operation_1",
      },
    });
  });
});
