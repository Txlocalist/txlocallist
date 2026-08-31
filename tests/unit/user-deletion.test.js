import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/event-payments", () => ({ cancelEventPosting: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(() => false),
}));

import {
  buildUserDeletionImpact,
  getUserDeletionBlockers,
  isDeletionConfirmationValid,
} from "@/lib/user-deletion";

function target(overrides = {}) {
  return {
    id: "user_1",
    email: "person@example.com",
    name: "Person",
    role: "USER",
    roleVersion: 3,
    deletedAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingStatus: null,
    cancelAtPeriodEnd: false,
    ownedBusinesses: [],
    events: [],
    eventPayments: [],
    roleTransitionsAsActor: [],
    roleTransitionsAsTarget: [],
    _count: {
      sessions: 0,
      favorites: 0,
      likes: 0,
      eventFavorites: 0,
      eventLikes: 0,
    },
    ...overrides,
  };
}

function blockers(currentTarget, options = {}) {
  return getUserDeletionBlockers({
    actorId: options.actorId ?? "admin_1",
    target: currentTarget,
    adminCount: options.adminCount ?? 2,
    stripeInspection: options.stripeInspection ?? {
      checked: true,
      renewals: [],
    },
  });
}

describe("user deletion safeguards", () => {
  test("allows a settled free user to be deleted", () => {
    expect(blockers(target())).toEqual([]);
  });

  test("protects the acting Admin and the final Admin", () => {
    expect(blockers(target(), { actorId: "user_1" })).toContain(
      "You cannot delete your own account.",
    );
    expect(blockers(target({ role: "ADMIN" }), { adminCount: 1 })).toContain(
      "The final Admin account cannot be deleted.",
    );
  });

  test("blocks active role changes and event-payment Checkouts", () => {
    const messages = blockers(
      target({
        roleTransitionsAsTarget: [{ id: "transition_1" }],
        eventPayments: [{ id: "payment_1", status: "PROCESSING" }],
      }),
    );

    expect(messages).toContain(
      "Finish or resolve the active role change before deleting this account.",
    );
    expect(messages).toContain(
      "An active event payment Checkout must finish or expire before deleting this account.",
    );
  });

  test("blocks live renewals, open subscription Checkouts, and schedules", () => {
    const messages = blockers(
      target({ billingStatus: "ACTIVE", cancelAtPeriodEnd: false }),
      {
        stripeInspection: {
          checked: true,
          renewals: [
            { id: "cs_1", status: "open subscription checkout" },
            { id: "sched_1", status: "active subscription schedule" },
          ],
        },
      },
    );

    expect(messages).toContain(
      "An open subscription Checkout must expire or be closed in Stripe before deletion.",
    );
    expect(messages).toContain(
      "Cancel or release the subscription schedule in Stripe before deletion.",
    );
    expect(messages).toContain(
      "Future renewal is still active. Change the role to Complimentary first so cancellation is verified.",
    );
  });

  test("permits an active local subscription once period-end cancellation is set", () => {
    expect(
      blockers(target({ billingStatus: "ACTIVE", cancelAtPeriodEnd: true })),
    ).toEqual([]);
  });
});

describe("user deletion confirmation and impact", () => {
  test("requires the target email and tolerates casing or surrounding spaces", () => {
    expect(isDeletionConfirmationValid(" Person@Example.com ", "person@example.com"))
      .toBe(true);
    expect(isDeletionConfirmationValid("other@example.com", "person@example.com"))
      .toBe(false);
  });

  test("counts retained payments once when buyer and event-owner records overlap", () => {
    const impact = buildUserDeletionImpact(
      target({
        eventPayments: [
          { id: "payment_1", status: "PAID" },
          { id: "payment_2", status: "REFUNDED" },
        ],
        events: [
          {
            id: "event_1",
            status: "PUBLISHED",
            payments: [
              { id: "payment_1" },
              { id: "payment_3" },
            ],
          },
        ],
      }),
    );

    expect(impact.eventsCancelled).toBe(1);
    expect(impact.billingRecordsRetained).toBe(3);
  });
});
