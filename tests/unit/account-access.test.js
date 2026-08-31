import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  deriveUserStatusTags,
  getAccountAccess,
  isStaffRole,
  resolveAccountAccess,
  syncEffectiveAccessPlans,
} from "@/lib/account-access";
import { roleTransitionRequiresCancellation } from "@/lib/role-transitions";

const freePlan = {
  id: "plan_free",
  name: "Free",
  slug: "free",
  priceCents: 0,
  billingPeriod: "monthly",
  features: "{}",
};
const starterPlan = {
  id: "plan_starter",
  name: "Local Business Membership",
  slug: "starter",
  priceCents: 1000,
  billingPeriod: "monthly",
  features: "{}",
};

function user(overrides = {}) {
  return {
    id: "user_1",
    email: "user@example.com",
    name: "Test User",
    role: "USER",
    deletedAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    accountPlanId: freePlan.id,
    accountPlan: freePlan,
    ...overrides,
  };
}

function resolve(currentUser, legacySubscriptions = []) {
  return resolveAccountAccess({
    user: currentUser,
    freePlan,
    starterPlan,
    legacySubscriptions,
  });
}

describe("account access resolution", () => {
  test("keeps a standard User on Free without creator access", () => {
    const access = resolve(user());
    expect(access).toMatchObject({
      primaryAccessSource: "FREE",
      hasStripeAccess: false,
      hasMembershipAccess: false,
      hasCreatorAccess: false,
      activePlanId: freePlan.id,
      canStartCheckout: true,
      canOpenPortal: false,
    });
  });

  test("treats Complimentary as Starter creator access without paid billing", () => {
    const access = resolve(user({ role: "COMPLIMENTARY" }));
    expect(access).toMatchObject({
      primaryAccessSource: "COMPLIMENTARY",
      hasStripeAccess: false,
      hasPaidAccess: false,
      hasComplimentaryAccess: true,
      hasMembershipAccess: true,
      hasCreatorAccess: true,
      activePlanId: starterPlan.id,
      canStartCheckout: false,
      canOpenPortal: false,
    });
  });

  test.each(["MANAGER", "ADMIN"])("grants %s staff creator access without membership billing", (role) => {
    const access = resolve(user({ role }));
    expect(access).toMatchObject({
      primaryAccessSource: "STAFF",
      hasStripeAccess: false,
      hasMembershipAccess: false,
      hasStaffAccess: true,
      hasCreatorAccess: true,
      activePlanId: starterPlan.id,
      canStartCheckout: false,
    });
  });

  test("keeps real Stripe billing primary when a paid account is Complimentary", () => {
    const access = resolve(user({
      role: "COMPLIMENTARY",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      billingStatus: "ACTIVE",
      accountPlanId: starterPlan.id,
      accountPlan: starterPlan,
      cancelAtPeriodEnd: true,
    }));
    expect(access).toMatchObject({
      primaryAccessSource: "STRIPE_ACCOUNT",
      hasStripeAccess: true,
      hasComplimentaryAccess: true,
      hasCreatorAccess: true,
      activePlanId: starterPlan.id,
      canOpenPortal: false,
      cancelAtPeriodEnd: true,
    });
  });

  test("recognizes an active legacy business subscription", () => {
    const access = resolve(user(), [{
      status: "TRIALING",
      stripeSubscriptionId: "sub_legacy",
      stripeCustomerId: "cus_legacy",
      currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      plan: starterPlan,
    }]);
    expect(access).toMatchObject({
      primaryAccessSource: "STRIPE_LEGACY",
      hasStripeAccess: true,
      hasCreatorAccess: true,
      stripeSubscriptionId: "sub_legacy",
      activePlanId: starterPlan.id,
    });
  });

  test("returns no feature access for a deleted account", async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(
          user({ deletedAt: new Date("2026-08-28T00:00:00Z") }),
        ),
      },
    };

    await expect(getAccountAccess("user_1", db)).resolves.toBeNull();
  });

  test("lets billing reconciliation safely skip plan writes for a deleted account", async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(
          user({ deletedAt: new Date("2026-08-28T00:00:00Z") }),
        ),
        update: vi.fn(),
      },
      plan: {
        findUnique: vi.fn(({ where }) =>
          Promise.resolve(where.slug === "free" ? freePlan : starterPlan),
        ),
      },
      subscription: { findMany: vi.fn().mockResolvedValue([]) },
      business: { updateMany: vi.fn() },
    };

    await expect(syncEffectiveAccessPlans("user_1", db)).resolves.toBe(freePlan.id);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.business.updateMany).not.toHaveBeenCalled();
  });
});

describe("derived user status", () => {
  test("keeps a one-time event buyer Free instead of treating them as a subscriber", () => {
    const labels = deriveUserStatusTags({
      role: "USER",
      ownedBusinessCount: 1,
      hasPaidEventPayment: true,
    }).map((tag) => tag.label);
    expect(labels).toEqual(["Free", "Business Owner", "One-Time Event Buyer"]);
    expect(labels).not.toContain("Paid Subscriber");
  });

  test("allows truthful overlapping paid and Complimentary tags", () => {
    const labels = deriveUserStatusTags({
      role: "COMPLIMENTARY",
      billingStatus: "ACTIVE",
      stripeSubscriptionId: "sub_1",
      cancelAtPeriodEnd: true,
      includeBillingHealth: true,
    }).map((tag) => tag.label);
    expect(labels).toContain("Paid Subscriber");
    expect(labels).toContain("Complimentary Access");
    expect(labels).toContain("Cancels at Period End");
  });
});

describe("role invariants", () => {
  test("only Complimentary transitions schedule Stripe cancellation", () => {
    expect(roleTransitionRequiresCancellation("COMPLIMENTARY")).toBe(true);
    expect(roleTransitionRequiresCancellation("USER")).toBe(false);
    expect(roleTransitionRequiresCancellation("MANAGER")).toBe(false);
    expect(roleTransitionRequiresCancellation("ADMIN")).toBe(false);
  });

  test("only Manager and Admin are staff roles", () => {
    expect(isStaffRole("MANAGER")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("COMPLIMENTARY")).toBe(false);
    expect(isStaffRole("USER")).toBe(false);
  });
});
