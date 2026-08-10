import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  function clone(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, clone(nested)]),
      );
    }
    return value;
  }

  function sameValue(left, right) {
    if (left instanceof Date || right instanceof Date) {
      return left instanceof Date &&
        right instanceof Date &&
        left.getTime() === right.getTime();
    }
    return left === right;
  }

  function matchesScalar(actual, condition) {
    if (
      condition === null ||
      condition instanceof Date ||
      typeof condition !== "object" ||
      Array.isArray(condition)
    ) {
      return sameValue(actual, condition);
    }

    if (Object.hasOwn(condition, "equals") && !sameValue(actual, condition.equals)) {
      return false;
    }
    if (condition.in && !condition.in.some((candidate) => sameValue(actual, candidate))) {
      return false;
    }
    if (condition.notIn && condition.notIn.some((candidate) => sameValue(actual, candidate))) {
      return false;
    }
    if (Object.hasOwn(condition, "not")) {
      const excluded = condition.not;
      if (
        excluded &&
        typeof excluded === "object" &&
        !(excluded instanceof Date)
      ) {
        if (matchesScalar(actual, excluded)) return false;
      } else if (sameValue(actual, excluded)) {
        return false;
      }
    }
    if (Object.hasOwn(condition, "gt") && !(actual > condition.gt)) return false;
    if (Object.hasOwn(condition, "gte") && !(actual >= condition.gte)) return false;
    if (Object.hasOwn(condition, "lt") && !(actual < condition.lt)) return false;
    if (Object.hasOwn(condition, "lte") && !(actual <= condition.lte)) return false;
    return true;
  }

  function matches(record, where = {}) {
    if (!record) return false;
    if (where.OR && !where.OR.some((branch) => matches(record, branch))) return false;
    if (where.AND && !where.AND.every((branch) => matches(record, branch))) return false;

    return Object.entries(where).every(([key, condition]) => {
      if (key === "OR" || key === "AND") return true;
      return matchesScalar(record[key], condition);
    });
  }

  function applyData(record, data, now) {
    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === "object" &&
        !(value instanceof Date) &&
        Object.hasOwn(value, "increment")
      ) {
        record[key] = (record[key] ?? 0) + value.increment;
      } else {
        record[key] = clone(value);
      }
    }
    record.updatedAt = now();
    return record;
  }

  function ordered(records, orderBy) {
    const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...records].sort((left, right) => {
      for (const clause of clauses) {
        const [field, direction] = Object.entries(clause)[0];
        const leftValue = left[field] instanceof Date ? left[field].getTime() : left[field];
        const rightValue = right[field] instanceof Date ? right[field].getTime() : right[field];
        if (leftValue === rightValue) continue;
        const comparison = leftValue < rightValue ? -1 : 1;
        return direction === "desc" ? -comparison : comparison;
      }
      return 0;
    });
  }

  const api = {
    state: null,
    transactionTail: Promise.resolve(),
    clock: 0,
  };

  api.now = () => {
    api.clock += 1;
    return new Date(1_800_000_000_000 + api.clock * 1_000);
  };

  api.reset = () => {
    api.clock = 0;
    api.transactionTail = Promise.resolve();
    api.state = {
      events: [],
      payments: [],
      users: [],
      checkoutSessions: new Map(),
      checkoutByIdempotencyKey: new Map(),
      paymentIntents: new Map(),
      refunds: new Map(),
      charges: new Map(),
      nextPayment: 1,
      nextSession: 1,
      nextRefund: 1,
    };
  };

  api.addEvent = (overrides = {}) => {
    const record = {
      id: "event_1",
      creatorId: "user_1",
      postingMethod: "ONE_TIME",
      status: "DRAFT",
      title: "Community market",
      startDate: new Date("2027-01-10T15:00:00.000Z"),
      endDate: new Date("2027-01-10T23:00:00.000Z"),
      publishedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: api.now(),
      updatedAt: api.now(),
      ...clone(overrides),
    };
    api.state.events.push(record);
    return record;
  };

  api.addUser = (overrides = {}) => {
    const record = {
      id: "user_1",
      email: "organizer@example.com",
      name: "Organizer",
      stripeCustomerId: "cus_event_1",
      ...clone(overrides),
    };
    api.state.users.push(record);
    return record;
  };

  api.addPayment = (overrides = {}) => {
    const record = {
      id: `payment_${api.state.nextPayment++}`,
      eventId: "event_1",
      userId: "user_1",
      status: "PROCESSING",
      stripePriceId: "price_event_post",
      stripeCustomerId: "cus_event_1",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeRefundId: null,
      stripeDisputeId: null,
      stripeDisputeStatus: null,
      amountCents: 1000,
      currency: "usd",
      eventStartDate: new Date("2027-01-10T15:00:00.000Z"),
      eventEndDate: new Date("2027-01-10T23:00:00.000Z"),
      checkoutExpiresAt: null,
      paidAt: null,
      refundedAt: null,
      refundedAmountCents: 0,
      stripeRefundCreatedAt: null,
      stripeRefundStatus: null,
      failureReason: null,
      createdAt: api.now(),
      updatedAt: api.now(),
      ...clone(overrides),
    };
    api.state.payments.push(record);
    return record;
  };

  api.addCheckoutSession = (overrides = {}) => {
    const record = {
      id: `cs_test_${api.state.nextSession++}`,
      status: "open",
      payment_status: "unpaid",
      url: "https://checkout.stripe.test/session",
      expires_at: Math.floor(Date.now() / 1000) + 1_800,
      mode: "payment",
      customer: "cus_event_1",
      client_reference_id: "user_1",
      metadata: {
        scope: "event_post",
        eventId: "event_1",
        paymentId: "payment_1",
        userId: "user_1",
      },
      payment_intent: null,
      amount_total: 1000,
      currency: "usd",
      created: Math.floor(Date.now() / 1000),
      line_items: {
        data: [{ price: { id: "price_event_post" }, quantity: 1 }],
      },
      ...clone(overrides),
    };
    api.state.checkoutSessions.set(record.id, record);
    return record;
  };

  api.prisma = {
    event: {
      findUnique: vi.fn(async (args) => {
        const event = api.state.events.find((record) => matches(record, args.where));
        if (!event) return null;
        const result = clone(event);
        if (args.include?.payments) {
          let payments = api.state.payments.filter(
            (payment) => payment.eventId === event.id &&
              matches(payment, args.include.payments.where ?? {}),
          );
          payments = ordered(payments, args.include.payments.orderBy);
          if (args.include.payments.take) payments = payments.slice(0, args.include.payments.take);
          result.payments = clone(payments);
        }
        return result;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const records = api.state.events.filter((record) => matches(record, where));
        records.forEach((record) => applyData(record, data, api.now));
        return { count: records.length };
      }),
      update: vi.fn(async ({ where, data }) => {
        const record = api.state.events.find((candidate) => matches(candidate, where));
        if (!record) throw Object.assign(new Error("Event not found"), { code: "P2025" });
        return clone(applyData(record, data, api.now));
      }),
    },
    eventPayment: {
      findUnique: vi.fn(async ({ where }) => {
        const record = api.state.payments.find((candidate) => matches(candidate, where));
        return clone(record ?? null);
      }),
      findFirst: vi.fn(async ({ where, orderBy, select } = {}) => {
        const records = ordered(
          api.state.payments.filter((record) => matches(record, where ?? {})),
          orderBy,
        );
        const record = records[0];
        if (!record) return null;
        if (!select) return clone(record);
        return Object.fromEntries(
          Object.keys(select)
            .filter((key) => select[key])
            .map((key) => [key, clone(record[key])]),
        );
      }),
      findMany: vi.fn(async ({ where, orderBy, select, take } = {}) => {
        let records = ordered(
          api.state.payments.filter((record) => matches(record, where ?? {})),
          orderBy,
        );
        if (take) records = records.slice(0, take);
        if (!select) return clone(records);
        return records.map((record) => Object.fromEntries(
          Object.keys(select)
            .filter((key) => select[key])
            .map((key) => [key, clone(record[key])]),
        ));
      }),
      count: vi.fn(async ({ where } = {}) =>
        api.state.payments.filter((record) => matches(record, where ?? {})).length),
      create: vi.fn(async ({ data }) => {
        const id = data.id ?? `payment_${api.state.nextPayment++}`;
        if (api.state.payments.some((record) => record.id === id)) {
          throw Object.assign(new Error("Unique payment constraint"), { code: "P2002" });
        }
        return clone(api.addPayment({
          ...data,
          id,
          status: data.status ?? "CREATED",
          createdAt: api.now(),
          updatedAt: api.now(),
        }));
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const records = api.state.payments.filter((record) => matches(record, where));
        records.forEach((record) => applyData(record, data, api.now));
        return { count: records.length };
      }),
      update: vi.fn(async ({ where, data }) => {
        const record = api.state.payments.find((candidate) => matches(candidate, where));
        if (!record) throw Object.assign(new Error("Payment not found"), { code: "P2025" });
        return clone(applyData(record, data, api.now));
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = api.state.payments.find((candidate) => matches(candidate, where));
        if (existing) return clone(applyData(existing, update, api.now));
        return api.prisma.eventPayment.create({ data: create });
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }) =>
        clone(api.state.users.find((record) => matches(record, where)) ?? null)),
    },
    $transaction: vi.fn(async (work) => {
      let release;
      const previous = api.transactionTail;
      api.transactionTail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await work(api.prisma);
      } finally {
        release();
      }
    }),
  };

  api.stripe = {
    checkout: {
      sessions: {
        create: vi.fn(async (params, options = {}) => {
          // Yield once so concurrent service calls exercise the reservation race.
          await Promise.resolve();
          const key = options.idempotencyKey;
          if (key && api.state.checkoutByIdempotencyKey.has(key)) {
            return clone(api.state.checkoutByIdempotencyKey.get(key));
          }

          const lineItem = params.line_items?.[0];
          const session = api.addCheckoutSession({
            id: `cs_test_${api.state.nextSession++}`,
            customer: params.customer,
            client_reference_id: params.client_reference_id,
            metadata: clone(params.metadata),
            expires_at: params.expires_at,
            url: `https://checkout.stripe.test/${key ?? "session"}`,
            line_items: {
              data: [{ price: { id: lineItem?.price }, quantity: lineItem?.quantity }],
            },
          });
          if (key) api.state.checkoutByIdempotencyKey.set(key, session);
          return clone(session);
        }),
        retrieve: vi.fn(async (sessionId) =>
          clone(api.state.checkoutSessions.get(sessionId) ?? null)),
        list: vi.fn(async ({ customer, created, limit = 10, starting_after: startingAfter }) => {
          let sessions = [...api.state.checkoutSessions.values()]
            .filter((session) => session.customer === customer)
            .filter((session) => !created?.gte || session.created >= created.gte)
            .sort((left, right) => right.created - left.created);
          if (startingAfter) {
            const cursor = sessions.findIndex((session) => session.id === startingAfter);
            sessions = cursor >= 0 ? sessions.slice(cursor + 1) : [];
          }
          return {
            data: clone(sessions.slice(0, limit)),
            has_more: sessions.length > limit,
          };
        }),
        expire: vi.fn(async (sessionId) => {
          const session = api.state.checkoutSessions.get(sessionId);
          if (!session) throw new Error("Checkout Session not found");
          session.status = "expired";
          session.url = null;
          return clone(session);
        }),
      },
    },
    paymentIntents: {
      retrieve: vi.fn(async (paymentIntentId) =>
        clone(api.state.paymentIntents.get(paymentIntentId) ?? null)),
    },
    refunds: {
      create: vi.fn(async ({ payment_intent: paymentIntentId, metadata }) => {
        const payment = api.state.payments.find(
          (candidate) => candidate.stripePaymentIntentId === paymentIntentId,
        );
        const refund = {
          id: `re_test_${api.state.nextRefund++}`,
          status: "succeeded",
          amount: payment?.amountCents ?? 1000,
          currency: payment?.currency ?? "usd",
          payment_intent: paymentIntentId,
          charge: null,
          created: 1_800_000_100,
          failure_reason: null,
          metadata: clone(metadata),
        };
        api.state.refunds.set(refund.id, refund);
        return clone(refund);
      }),
      retrieve: vi.fn(async (refundId) =>
        clone(api.state.refunds.get(refundId) ?? null)),
    },
    charges: {
      retrieve: vi.fn(async (chargeId) =>
        clone(api.state.charges.get(chargeId) ?? null)),
    },
  };

  api.reset();
  return api;
});

vi.mock("@/lib/prisma", () => ({ prisma: harness.prisma }));
vi.mock("@/lib/billing", () => ({
  ensureStripeCustomerForUser: vi.fn(async (user) => user.stripeCustomerId ?? "cus_event_1"),
}));
vi.mock("@/lib/pricing", () => ({
  BILLING_CURRENCY: "usd",
  EVENT_POST_CHECKOUT_DISCLOSURE:
    "Stripe collects the one-time $10 event fee after form validation and before admin review. Payment submits the event for review and does not guarantee publication. Full refunds are automatically initiated for submissions denied by an admin and duplicate charges. Organizer cancellations are not automatically refunded. Tax is not automatically calculated or collected in Checkout.",
  EVENT_POST_PRICE_CENTS: 1000,
  isEventPostingEnabled: vi.fn(() => true),
  validateEventPostPrice: vi.fn(async () => "price_event_post"),
}));
vi.mock("@/lib/stripe", () => ({
  getSiteUrl: vi.fn(() => "https://txlocalist.test"),
  getStripe: vi.fn(() => harness.stripe),
  isStripeConfigured: vi.fn(() => true),
}));

import {
  createEventCheckoutSession,
  denyEventAndRefund,
  expireOpenEventCheckoutSessions,
  handleEventChargeRefunded,
  handleEventChargeDispute,
  handleEventChargeDisputeClosed,
  handleEventCheckoutSessionProcessing,
  handleEventRefundUpdated,
  retryEventRefund,
  syncEventPaymentFromCheckoutSession,
} from "@/lib/event-payments";

function seedCheckoutOwner() {
  harness.addUser();
  return harness.addEvent();
}

beforeEach(() => {
  harness.reset();
  vi.clearAllMocks();
});

describe("event payment service integration", () => {
  describe("Checkout attempt coordination", () => {
    it("shows the event payment policy and explicitly disables automatic tax", async () => {
      seedCheckoutOwner();

      await createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      });

      const [params] = harness.stripe.checkout.sessions.create.mock.calls[0];
      expect(params.automatic_tax).toEqual({ enabled: false });
      expect(params.custom_text?.submit?.message).toContain("one-time $10 event fee");
      expect(params.custom_text?.submit?.message).toContain("before admin review");
      expect(params.custom_text?.submit?.message).toContain("does not guarantee publication");
      expect(params.custom_text?.submit?.message).toContain("denied by an admin");
      expect(params.custom_text?.submit?.message).toContain("duplicate charges");
      expect(params.custom_text?.submit?.message).toContain(
        "Organizer cancellations are not automatically refunded",
      );
      expect(params.custom_text?.submit?.message).toContain(
        "Tax is not automatically calculated or collected",
      );
    });

    it("reuses the same open Checkout Session on a repeated request", async () => {
      seedCheckoutOwner();

      const first = await createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      });
      const second = await createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      });

      expect(second.id).toBe(first.id);
      expect(harness.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      expect(harness.state.payments).toHaveLength(1);
      expect(harness.state.payments[0]).toMatchObject({
        status: "PROCESSING",
        stripeCheckoutSessionId: first.id,
      });
    });

    it("blocks retry while a completed Checkout Session still has delayed payment pending", async () => {
      seedCheckoutOwner();
      const session = harness.addCheckoutSession({
        id: "cs_async_pending",
        status: "complete",
        payment_status: "unpaid",
        url: null,
        metadata: {
          scope: "event_post",
          eventId: "event_1",
          paymentId: "payment_async_pending",
          userId: "user_1",
        },
      });
      harness.addPayment({
        id: "payment_async_pending",
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
      });

      await expect(createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      })).rejects.toThrow(/still processing|payment.*processing|wait for stripe/i);

      expect(harness.stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(harness.stripe.checkout.sessions.expire).not.toHaveBeenCalled();
      expect(harness.state.payments).toHaveLength(1);
      expect(harness.state.payments[0].status).toBe("PROCESSING");
    });

    it("records Checkout completion as processing until delayed payment settles", async () => {
      seedCheckoutOwner();
      const session = harness.addCheckoutSession({
        id: "cs_async_completed",
        status: "complete",
        payment_status: "unpaid",
        url: null,
        metadata: {
          scope: "event_post",
          eventId: "event_1",
          paymentId: "payment_async_completed",
          userId: "user_1",
        },
      });
      harness.addPayment({
        id: "payment_async_completed",
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
      });

      await expect(handleEventCheckoutSessionProcessing(session)).resolves.toBe(true);

      expect(harness.state.payments[0]).toMatchObject({
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
        failureReason: "Stripe is still processing this event payment.",
      });
      expect(harness.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("does not expire a completed Checkout Session whose delayed payment is pending", async () => {
      seedCheckoutOwner();
      const session = harness.addCheckoutSession({
        id: "cs_async_edit_blocked",
        status: "complete",
        payment_status: "unpaid",
        url: null,
        metadata: {
          scope: "event_post",
          eventId: "event_1",
          paymentId: "payment_async_edit_blocked",
          userId: "user_1",
        },
      });
      harness.addPayment({
        id: "payment_async_edit_blocked",
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
      });

      await expect(expireOpenEventCheckoutSessions("event_1"))
        .rejects.toThrow(/still processing|wait for stripe/i);

      expect(harness.state.payments[0].status).toBe("PROCESSING");
      expect(harness.stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    });

    it("blocks edits while a fresh session-less reservation is still ambiguous", async () => {
      seedCheckoutOwner();
      harness.addPayment({
        id: "payment_session_pending_link",
        status: "CREATED",
        stripeCheckoutSessionId: null,
        checkoutExpiresAt: new Date("2027-01-20T00:00:00.000Z"),
      });

      await expect(expireOpenEventCheckoutSessions("event_1"))
        .rejects.toThrow(/still being prepared|wait/i);

      expect(harness.stripe.checkout.sessions.list).toHaveBeenCalledOnce();
      expect(harness.state.payments[0].status).toBe("CREATED");
      expect(harness.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("converges concurrent Checkout requests on one payment and one idempotent Session", async () => {
      seedCheckoutOwner();

      const [first, second] = await Promise.all([
        createEventCheckoutSession({ eventId: "event_1", userId: "user_1" }),
        createEventCheckoutSession({ eventId: "event_1", userId: "user_1" }),
      ]);

      expect(second.id).toBe(first.id);
      expect(harness.state.payments).toHaveLength(1);
      expect(harness.state.payments[0]).toMatchObject({
        status: "PROCESSING",
        stripeCheckoutSessionId: first.id,
      });

      const idempotencyKeys = harness.stripe.checkout.sessions.create.mock.calls
        .map(([, options]) => options?.idempotencyKey)
        .filter(Boolean);
      expect(idempotencyKeys.length).toBeGreaterThan(0);
      expect(new Set(idempotencyKeys)).toEqual(
        new Set([`event-checkout:${harness.state.payments[0].id}`]),
      );
    });

    it("releases an expired session-less reservation only after Stripe confirms no Session exists", async () => {
      seedCheckoutOwner();
      harness.addPayment({
        id: "payment_abandoned_reservation",
        status: "CREATED",
        stripeCheckoutSessionId: null,
        checkoutExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const session = await createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      });

      expect(harness.stripe.checkout.sessions.list).toHaveBeenCalledOnce();
      expect(harness.state.payments).toHaveLength(2);
      expect(harness.state.payments[0]).toMatchObject({
        id: "payment_abandoned_reservation",
        status: "FAILED",
      });
      expect(harness.state.payments[1]).toMatchObject({
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
      });
      expect(harness.stripe.checkout.sessions.create).toHaveBeenCalledOnce();
    });

    it("recovers a Stripe Session created before its local reservation was linked", async () => {
      seedCheckoutOwner();
      const payment = harness.addPayment({
        id: "payment_unlinked_session",
        status: "CREATED",
        stripeCheckoutSessionId: null,
        checkoutExpiresAt: new Date("2027-01-20T00:00:00.000Z"),
      });
      const session = harness.addCheckoutSession({
        id: "cs_unlinked_session",
        created: Math.floor(payment.createdAt.getTime() / 1000) + 1,
        metadata: {
          scope: "event_post",
          eventId: payment.eventId,
          paymentId: payment.id,
          userId: payment.userId,
        },
      });

      const recovered = await createEventCheckoutSession({
        eventId: "event_1",
        userId: "user_1",
      });

      expect(recovered.id).toBe(session.id);
      expect(harness.stripe.checkout.sessions.list).toHaveBeenCalledOnce();
      expect(harness.stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(harness.state.payments).toHaveLength(1);
      expect(harness.state.payments[0]).toMatchObject({
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
      });
    });
  });

  describe("out-of-order financial events", () => {
    it.each(["failed", "canceled"])(
      "does not regress a Stripe %s refund when its pending event arrives late",
      async (terminalStatus) => {
        harness.addUser();
        harness.addEvent({ status: "PENDING" });
        harness.addPayment({
          id: "payment_terminal_refund",
          status: "PAID",
          stripePaymentIntentId: "pi_terminal_refund",
          paidAt: new Date("2026-12-01T17:00:00.000Z"),
        });
        const terminalRefund = {
          id: "re_terminal_refund",
          status: terminalStatus,
          amount: 1000,
          payment_intent: "pi_terminal_refund",
          charge: null,
          created: 1_800_000_050,
          failure_reason: `Stripe marked the refund ${terminalStatus}.`,
        };

        await handleEventRefundUpdated(terminalRefund);
        await handleEventRefundUpdated({
          ...terminalRefund,
          status: "pending",
          failure_reason: null,
        });

        expect(harness.state.payments[0]).toMatchObject({
          status: "REFUND_FAILED",
          stripeRefundId: terminalRefund.id,
          stripeRefundStatus: terminalStatus,
          stripeRefundCreatedAt: new Date(terminalRefund.created * 1000),
          failureReason: terminalRefund.failure_reason,
        });

        await handleEventRefundUpdated({
          ...terminalRefund,
          id: "re_retry_refund",
          status: "pending",
          created: terminalRefund.created + 1,
          failure_reason: null,
        });

        expect(harness.state.payments[0]).toMatchObject({
          status: "REFUND_PENDING",
          stripeRefundId: "re_retry_refund",
          stripeRefundStatus: "pending",
          stripeRefundCreatedAt: new Date((terminalRefund.created + 1) * 1000),
          failureReason: null,
        });
      },
    );

    it("allows an operational REFUND_FAILED state to recover for the same refund", async () => {
      harness.addUser();
      harness.addEvent({ status: "PENDING" });
      harness.addPayment({
        status: "REFUND_FAILED",
        stripePaymentIntentId: "pi_operational_refund",
        stripeRefundId: "re_operational_refund",
        stripeRefundCreatedAt: new Date(1_800_000_050 * 1000),
        stripeRefundStatus: "pending",
        failureReason: "Stripe API request timed out.",
      });

      await handleEventRefundUpdated({
        id: "re_operational_refund",
        status: "pending",
        amount: 1000,
        payment_intent: "pi_operational_refund",
        charge: null,
        created: 1_800_000_050,
        failure_reason: null,
      });

      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUND_PENDING",
        stripeRefundStatus: "pending",
        failureReason: null,
      });
    });

    it("keeps a same-second local retry active when the old refund arrives late", async () => {
      harness.addUser();
      harness.addEvent({ status: "DENIED" });
      harness.addPayment({
        status: "REFUND_FAILED",
        stripePaymentIntentId: "pi_same_second_retry",
        stripeRefundId: "re_failed_attempt",
        stripeRefundCreatedAt: new Date(1_800_000_050 * 1000),
        stripeRefundStatus: "failed",
        failureReason: "Stripe marked the refund failed.",
      });
      const failedRefund = {
        id: "re_failed_attempt",
        status: "failed",
        amount: 1000,
        currency: "usd",
        payment_intent: "pi_same_second_retry",
        charge: null,
        created: 1_800_000_050,
        failure_reason: "Stripe marked the refund failed.",
      };
      harness.state.refunds.set(failedRefund.id, failedRefund);
      harness.stripe.refunds.create.mockResolvedValueOnce({
        ...failedRefund,
        id: "re_pending_retry",
        status: "pending",
        failure_reason: null,
      });

      await retryEventRefund("event_1");

      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUND_PENDING",
        stripeRefundId: "re_pending_retry",
        stripeRefundStatus: "pending",
        stripeRefundCreatedAt: new Date(failedRefund.created * 1000),
        failureReason: null,
      });

      await handleEventRefundUpdated(failedRefund);

      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUND_PENDING",
        stripeRefundId: "re_pending_retry",
        stripeRefundStatus: "pending",
        stripeRefundCreatedAt: new Date(failedRefund.created * 1000),
        failureReason: null,
      });
    });

    it("backfills refund audit metadata after charge.refunded wins the race", async () => {
      harness.addUser();
      harness.addEvent({ status: "PENDING" });
      harness.addPayment({
        status: "PAID",
        stripePaymentIntentId: "pi_charge_first",
        paidAt: new Date("2026-12-01T17:00:00.000Z"),
      });

      await handleEventChargeRefunded({
        id: "ch_charge_first",
        payment_intent: "pi_charge_first",
        amount: 1000,
        amount_refunded: 1000,
      });
      const refundedAt = harness.state.payments[0].refundedAt;

      await handleEventRefundUpdated({
        id: "re_charge_first",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        payment_intent: "pi_charge_first",
        charge: "ch_charge_first",
        created: 1_800_000_075,
        failure_reason: null,
      });

      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUNDED",
        stripeRefundId: "re_charge_first",
        stripeRefundStatus: "succeeded",
        stripeRefundCreatedAt: new Date(1_800_000_075 * 1000),
        refundedAmountCents: 1000,
        refundedAt,
        failureReason: null,
      });
    });

    it.each(["pending", "failed", "canceled"])(
      "does not backfill a %s refund identity onto a charge-confirmed refund",
      async (refundStatus) => {
        harness.addUser();
        harness.addEvent({ status: "PENDING" });
        harness.addPayment({
          status: "PAID",
          stripePaymentIntentId: "pi_unsafe_backfill",
          paidAt: new Date("2026-12-01T17:00:00.000Z"),
        });
        await handleEventChargeRefunded({
          id: "ch_unsafe_backfill",
          payment_intent: "pi_unsafe_backfill",
          amount: 1000,
          amount_refunded: 1000,
        });

        await handleEventRefundUpdated({
          id: "re_unsafe_backfill",
          status: refundStatus,
          amount: 1000,
          currency: "usd",
          payment_intent: "pi_unsafe_backfill",
          charge: "ch_unsafe_backfill",
          created: 1_800_000_075,
          failure_reason: refundStatus === "pending" ? null : "Terminal refund state.",
        });

        expect(harness.state.payments[0]).toMatchObject({
          status: "REFUNDED",
          stripeRefundId: null,
          stripeRefundStatus: null,
          stripeRefundCreatedAt: null,
          refundedAmountCents: 1000,
        });
      },
    );

    it("rejects partial, wrong-currency, and conflicting refund identity backfills", async () => {
      harness.addUser();
      harness.addEvent({ status: "CANCELLED" });
      harness.addPayment({
        status: "REFUNDED",
        stripePaymentIntentId: "pi_backfill_boundary",
        stripeRefundId: null,
        refundedAt: new Date("2026-12-01T18:00:00.000Z"),
        refundedAmountCents: 1000,
      });
      const candidate = {
        id: "re_backfill_candidate",
        status: "succeeded",
        amount: 500,
        currency: "usd",
        payment_intent: "pi_backfill_boundary",
        charge: null,
        created: 1_800_000_075,
        failure_reason: null,
      };

      await handleEventRefundUpdated(candidate);
      await handleEventRefundUpdated({
        ...candidate,
        amount: 1000,
        currency: "cad",
      });
      expect(harness.state.payments[0]).toMatchObject({
        stripeRefundId: null,
        stripeRefundStatus: null,
        stripeRefundCreatedAt: null,
      });

      Object.assign(harness.state.payments[0], {
        stripeRefundId: "re_canonical_refund",
        stripeRefundStatus: "succeeded",
        stripeRefundCreatedAt: new Date(1_800_000_050 * 1000),
      });
      await handleEventRefundUpdated({
        ...candidate,
        amount: 1000,
        created: 1_800_000_100,
      });

      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUNDED",
        stripeRefundId: "re_canonical_refund",
        stripeRefundStatus: "succeeded",
        stripeRefundCreatedAt: new Date(1_800_000_050 * 1000),
        refundedAmountCents: 1000,
      });
      expect(harness.state.events[0].status).toBe("CANCELLED");
    });

    it("correlates an early full refund through trusted PaymentIntent metadata", async () => {
      seedCheckoutOwner();
      const payment = harness.addPayment({
        id: "payment_early_refund",
        status: "PROCESSING",
        stripePaymentIntentId: null,
      });
      harness.state.paymentIntents.set("pi_early_refund", {
        id: "pi_early_refund",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        customer: "cus_event_1",
        metadata: {
          scope: "event_post",
          eventId: payment.eventId,
          paymentId: payment.id,
          userId: payment.userId,
        },
      });

      const handled = await handleEventRefundUpdated({
        id: "re_early_refund",
        status: "succeeded",
        amount: 1000,
        payment_intent: "pi_early_refund",
        charge: null,
        created: 1_800_000_050,
        failure_reason: null,
      });

      expect(handled).toBe(true);
      expect(harness.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        "pi_early_refund",
      );
      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUNDED",
        stripePaymentIntentId: "pi_early_refund",
        stripeRefundId: "re_early_refund",
        refundedAmountCents: 1000,
      });
      expect(harness.state.events[0].status).not.toBe("PUBLISHED");
    });

    it("correlates an early dispute and prevents a later paid Checkout from promoting the event", async () => {
      seedCheckoutOwner();
      const session = harness.addCheckoutSession({
        id: "cs_early_dispute",
        status: "complete",
        payment_status: "paid",
        payment_intent: "pi_early_dispute",
        metadata: {
          scope: "event_post",
          eventId: "event_1",
          paymentId: "payment_early_dispute",
          userId: "user_1",
        },
      });
      const payment = harness.addPayment({
        id: "payment_early_dispute",
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: null,
      });
      harness.state.paymentIntents.set("pi_early_dispute", {
        id: "pi_early_dispute",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        customer: "cus_event_1",
        metadata: {
          scope: "event_post",
          eventId: payment.eventId,
          paymentId: payment.id,
          userId: payment.userId,
        },
      });

      const handled = await handleEventChargeDispute(
        { id: "ch_early_dispute", payment_intent: "pi_early_dispute" },
        "needs_response",
        "dp_early_dispute",
      );

      expect(handled).toBe(true);
      expect(harness.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        "pi_early_dispute",
      );
      expect(harness.state.payments[0]).toMatchObject({
        status: "DISPUTED",
        stripePaymentIntentId: "pi_early_dispute",
        stripeDisputeId: "dp_early_dispute",
        stripeDisputeStatus: "needs_response",
        paidAt: null,
      });
      expect(harness.state.events[0]).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "PAYMENT_DISPUTE",
      });

      const synced = await syncEventPaymentFromCheckoutSession(
        session.id,
        "user_1",
        "event_1",
      );

      expect(synced).toBe(false);
      expect(harness.state.payments[0]).toMatchObject({
        status: "DISPUTED",
        paidAt: null,
      });
      expect(harness.state.events[0]).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "PAYMENT_DISPUTE",
      });
    });

    it("restores an unvalidated attempt to processing after a favorable early dispute closure", async () => {
      seedCheckoutOwner();
      const session = harness.addCheckoutSession({
        id: "cs_early_dispute_won",
        status: "complete",
        payment_status: "paid",
        payment_intent: "pi_early_dispute_won",
        metadata: {
          scope: "event_post",
          eventId: "event_1",
          paymentId: "payment_early_dispute_won",
          userId: "user_1",
        },
      });
      const payment = harness.addPayment({
        id: "payment_early_dispute_won",
        status: "PROCESSING",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: null,
      });
      harness.state.paymentIntents.set("pi_early_dispute_won", {
        id: "pi_early_dispute_won",
        status: "succeeded",
        amount: 1000,
        currency: "usd",
        customer: "cus_event_1",
        metadata: {
          scope: "event_post",
          eventId: payment.eventId,
          paymentId: payment.id,
          userId: payment.userId,
        },
      });

      await handleEventChargeDispute(
        { id: "ch_early_dispute_won", payment_intent: "pi_early_dispute_won" },
        "needs_response",
        "dp_early_dispute_won",
      );
      const handled = await handleEventChargeDisputeClosed(
        { id: "ch_early_dispute_won", payment_intent: "pi_early_dispute_won" },
        "won",
        "dp_early_dispute_won",
      );

      expect(handled).toBe(true);
      expect(harness.state.payments[0]).toMatchObject({
        status: "PROCESSING",
        stripePaymentIntentId: "pi_early_dispute_won",
        stripeDisputeId: "dp_early_dispute_won",
        stripeDisputeStatus: "won",
        paidAt: null,
        failureReason: null,
      });
      expect(harness.state.events[0]).toMatchObject({
        status: "DRAFT",
        cancelledAt: null,
        cancellationReason: null,
      });
    });

    it("does not re-entitle a refund-required payment after a favorable dispute closure", async () => {
      harness.addUser();
      harness.addEvent({ status: "PENDING" });
      harness.addPayment({
        id: "payment_refund_dispute",
        status: "REFUND_PENDING",
        stripePaymentIntentId: "pi_refund_dispute",
        paidAt: new Date("2026-12-01T17:00:00.000Z"),
        failureReason: "The event changed before payment settled.",
      });

      await handleEventChargeDispute(
        { id: "ch_refund_dispute", payment_intent: "pi_refund_dispute" },
        "needs_response",
        "dp_refund_dispute",
      );
      const handled = await handleEventChargeDisputeClosed(
        { id: "ch_refund_dispute", payment_intent: "pi_refund_dispute" },
        "won",
        "dp_refund_dispute",
      );

      expect(handled).toBe(true);
      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUND_PENDING",
        stripeDisputeStatus: "won",
        failureReason: "The event changed before payment settled.",
      });
      expect(harness.state.events[0]).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "PAYMENT_DISPUTE",
      });
    });
  });

  describe("denial refund policy", () => {
    it("fully refunds a paid one-time event denied during re-review", async () => {
      harness.addUser();
      harness.addEvent({
        status: "PENDING",
        publishedAt: new Date("2026-12-01T18:00:00.000Z"),
      });
      harness.addPayment({
        id: "payment_re_review",
        status: "PAID",
        stripePaymentIntentId: "pi_re_review",
        paidAt: new Date("2026-12-01T17:00:00.000Z"),
      });

      await denyEventAndRefund("event_1");

      expect(harness.state.events[0].status).toBe("DENIED");
      expect(harness.stripe.refunds.create).toHaveBeenCalledTimes(1);
      expect(harness.stripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: "pi_re_review",
          metadata: expect.objectContaining({
            scope: "event_post",
            eventId: "event_1",
            paymentId: "payment_re_review",
          }),
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining("payment_re_review"),
        }),
      );
      expect(harness.state.payments[0]).toMatchObject({
        status: "REFUNDED",
        refundedAmountCents: 1000,
      });
    });
  });
});
