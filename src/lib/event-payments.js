import { ensureStripeCustomerForUser } from "@/lib/billing";
import { assertEventCheckoutSession } from "@/lib/event-checkout-validation";
import {
  isFavorableEventDisputeStatus,
  isTerminalEventDisputeStatus,
  TERMINAL_EVENT_DISPUTE_STATUSES,
} from "@/lib/event-disputes";
import {
  canAdminRefundPaidEvent,
  shouldKeepSettledPaymentForCancelledEvent,
} from "@/lib/event-payment-policy";
import { prisma } from "@/lib/prisma";
import {
  BILLING_CURRENCY,
  EVENT_POST_PRICE_CENTS,
  isEventPostingEnabled,
  validateEventPostPrice,
} from "@/lib/pricing";
import { getSiteUrl, getStripe, isStripeConfigured } from "@/lib/stripe";

export { assertEventCheckoutSession } from "@/lib/event-checkout-validation";

const FINAL_PAYMENT_STATUSES = new Set(["PAID", "REFUNDED", "DISPUTED"]);
const CHECKOUT_TTL_SECONDS = 31 * 60;
const DIRECT_CANCELLATION_REASONS = new Set(["ORGANIZER", "ADMIN"]);

function getObjectId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function compactError(error) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown Stripe error";
}

function paymentConcurrencyError(message) {
  return Object.assign(new Error(message), { code: "P2034" });
}

function getRefundPaymentStatus(refund, payment, refundedAmountCents) {
  if (
    refund.status === "succeeded" &&
    refundedAmountCents >= payment.amountCents
  ) {
    return "REFUNDED";
  }
  if (["failed", "canceled"].includes(refund.status)) return "REFUND_FAILED";
  return "REFUND_PENDING";
}

function getStripeObjectCreatedAt(value) {
  return Number.isFinite(value) ? new Date(value * 1000) : new Date();
}

async function getRefundedAmountCents(payment, refund) {
  let refundedAmountCents = Math.max(
    payment.refundedAmountCents ?? 0,
    refund.status === "succeeded" ? refund.amount ?? 0 : 0,
  );

  if (refund.status !== "succeeded" || refundedAmountCents >= payment.amountCents) {
    return refundedAmountCents;
  }

  const chargeId = getObjectId(refund.charge);
  if (!chargeId) return refundedAmountCents;

  const charge = await getStripe().charges.retrieve(chargeId);
  if (
    getObjectId(charge.payment_intent) === payment.stripePaymentIntentId &&
    charge.currency === payment.currency
  ) {
    refundedAmountCents = Math.max(refundedAmountCents, charge.amount_refunded ?? 0);
  }

  return refundedAmountCents;
}

async function persistEventRefund(payment, refund) {
  const refundedAmountCents = await getRefundedAmountCents(payment, refund);
  const stripeRefundCreatedAt = getStripeObjectCreatedAt(refund.created);

  return withSerializableRetry(async (tx) => {
    const current = await tx.eventPayment.findUnique({ where: { id: payment.id } });
    if (!current || current.status === "REFUNDED") return current;

    if (
      current.stripeRefundCreatedAt &&
      current.stripeRefundCreatedAt > stripeRefundCreatedAt &&
      refundedAmountCents < current.amountCents
    ) {
      return current;
    }

    const totalRefundedCents = Math.max(
      current.refundedAmountCents ?? 0,
      refundedAmountCents,
    );
    const nextStatus = getRefundPaymentStatus(refund, current, totalRefundedCents);
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: current.id,
        status: { not: "REFUNDED" },
        updatedAt: current.updatedAt,
      },
      data: {
        status: nextStatus,
        stripeRefundId: refund.id,
        stripeRefundCreatedAt,
        refundedAmountCents: totalRefundedCents,
        refundedAt: nextStatus === "REFUNDED" ? new Date() : null,
        failureReason: nextStatus === "REFUND_FAILED"
          ? refund.failure_reason ?? "Stripe reported that the refund failed."
          : refund.status === "succeeded" && totalRefundedCents < current.amountCents
            ? "Stripe has not yet confirmed a full refund."
            : null,
      },
    });
    if (updated.count !== 1) {
      throw paymentConcurrencyError("The refund state changed while it was being recorded.");
    }

    const updatedPayment = await tx.eventPayment.findUnique({
      where: { id: current.id },
    });

    if (nextStatus === "REFUNDED") {
      const otherPaidPayments = await tx.eventPayment.count({
        where: {
          eventId: current.eventId,
          id: { not: current.id },
          status: "PAID",
        },
      });

      if (otherPaidPayments === 0) {
        await tx.event.updateMany({
          where: { id: current.eventId, status: { not: "DENIED" } },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: "PAYMENT_REFUND",
          },
        });
      }
    }

    return updatedPayment;
  });
}

async function updateNonterminalRefundState(paymentId, data) {
  await prisma.eventPayment.updateMany({
    where: { id: paymentId, status: { not: "REFUNDED" } },
    data,
  });

  return prisma.eventPayment.findUnique({ where: { id: paymentId } });
}

async function withSerializableRetry(work, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (error?.code !== "P2034" || attempt === retries - 1) {
        throw error;
      }
    }
  }

  throw new Error("Could not complete the event payment transaction.");
}

export async function createEventCheckoutSession({ eventId, userId }) {
  if (!isEventPostingEnabled()) {
    throw new Error("One-time event posting is not enabled yet.");
  }

  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      creatorId: true,
      postingMethod: true,
      status: true,
      title: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!event || event.creatorId !== userId) {
    throw new Error("Event not found.");
  }

  if (event.postingMethod !== "ONE_TIME" || event.status !== "DRAFT") {
    throw new Error("This event is not eligible for a new one-time checkout.");
  }

  if (!event.endDate || event.endDate <= new Date()) {
    throw new Error("An event that has already ended cannot be purchased.");
  }

  const unresolvedRefund = await prisma.eventPayment.findFirst({
    where: {
      eventId,
      userId,
      status: { in: ["REFUND_PENDING", "REFUND_FAILED"] },
    },
    select: { id: true },
  });
  if (unresolvedRefund) {
    throw new Error(
      "A previous event payment is still being refunded. Do not submit another payment.",
    );
  }

  const existingAttempt = await prisma.eventPayment.findFirst({
    where: { eventId, userId, status: "PROCESSING" },
    orderBy: { createdAt: "desc" },
  });

  if (existingAttempt?.stripeCheckoutSessionId) {
    const existingSession = await getStripe().checkout.sessions.retrieve(
      existingAttempt.stripeCheckoutSessionId,
    );

    if (existingSession.status === "open" && existingSession.url) {
      return existingSession;
    }

    if (existingSession.payment_status === "paid") {
      await syncEventPaymentFromCheckoutSession(existingSession.id, userId);
      throw new Error("This event payment has already completed.");
    }

    await prisma.eventPayment.updateMany({
      where: { id: existingAttempt.id, status: "PROCESSING" },
      data: { status: "EXPIRED", failureReason: "Checkout session closed before payment." },
    });
  }

  const priceId = await validateEventPostPrice();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const customerId = await ensureStripeCustomerForUser(user);
  const payment = await prisma.eventPayment.create({
    data: {
      eventId,
      userId,
      stripePriceId: priceId,
      stripeCustomerId: customerId,
      amountCents: EVENT_POST_PRICE_CENTS,
      currency: BILLING_CURRENCY,
      eventStartDate: event.startDate,
      eventEndDate: event.endDate,
      status: "CREATED",
    },
  });

  try {
    const siteUrl = getSiteUrl();
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        client_reference_id: userId,
        success_url: `${siteUrl}/dashboard/events/${eventId}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/dashboard/events/${eventId}/checkout/cancel`,
        line_items: [{ price: priceId, quantity: 1 }],
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS,
        metadata: {
          scope: "event_post",
          eventId,
          paymentId: payment.id,
          userId,
        },
        payment_intent_data: {
          metadata: {
            scope: "event_post",
            eventId,
            paymentId: payment.id,
            userId,
          },
        },
      },
      { idempotencyKey: `event-checkout:${payment.id}` },
    );

    const activated = await withSerializableRetry(async (tx) => {
      const currentEvent = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          creatorId: true,
          postingMethod: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      });
      const stillEligible = Boolean(
        currentEvent &&
        currentEvent.creatorId === userId &&
        currentEvent.postingMethod === "ONE_TIME" &&
        currentEvent.status === "DRAFT" &&
        currentEvent.startDate?.getTime() === event.startDate?.getTime() &&
        currentEvent.endDate?.getTime() === event.endDate?.getTime() &&
        currentEvent.endDate &&
        currentEvent.endDate > new Date()
      );
      if (!stillEligible) return 0;

      const updated = await tx.eventPayment.updateMany({
        where: { id: payment.id, status: "CREATED" },
        data: {
          status: "PROCESSING",
          stripeCheckoutSessionId: session.id,
          checkoutExpiresAt: session.expires_at
            ? new Date(session.expires_at * 1000)
            : null,
        },
      });
      return updated.count;
    });

    if (activated !== 1) {
      await getStripe().checkout.sessions.expire(session.id).catch(() => null);
      throw new Error("The event changed before Checkout could open.");
    }

    return session;
  } catch (error) {
    await prisma.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["CREATED", "PROCESSING"] },
      },
      data: { status: "FAILED", failureReason: compactError(error) },
    }).catch(() => null);
    throw error;
  }
}

async function refundEventPayment(paymentId, reason = "Event post refund") {
  let payment = await prisma.eventPayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.status === "REFUNDED") {
    return payment;
  }

  if (!payment.stripePaymentIntentId) {
    return updateNonterminalRefundState(paymentId, {
        status: "REFUND_FAILED",
        failureReason: "No Stripe PaymentIntent was recorded for this payment.",
    });
  }

  const stripe = getStripe();

  if (payment.stripeRefundId) {
    try {
      const existingRefund = await stripe.refunds.retrieve(payment.stripeRefundId);
      const existingRefundedAmount = await getRefundedAmountCents(payment, existingRefund);
      const existingStatus = getRefundPaymentStatus(
        existingRefund,
        payment,
        existingRefundedAmount,
      );

      if (
        existingStatus === "REFUNDED" ||
        !["succeeded", "failed", "canceled"].includes(existingRefund.status)
      ) {
        return persistEventRefund(payment, existingRefund);
      }

      if (existingRefund.status === "succeeded") {
        const persisted = await persistEventRefund(payment, existingRefund);
        if (!persisted || persisted.status === "REFUNDED") return persisted;
        payment = persisted;
      }
    } catch (error) {
      const current = await updateNonterminalRefundState(payment.id, {
        status: "REFUND_FAILED",
        failureReason: compactError(error),
      });
      if (current?.status === "REFUNDED") return current;
      throw error;
    }
  }

  const pendingPayment = await updateNonterminalRefundState(paymentId, {
    status: "REFUND_PENDING",
    failureReason: null,
  });
  if (!pendingPayment || pendingPayment.status === "REFUNDED") {
    return pendingPayment;
  }
  payment = pendingPayment;

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        reason: "requested_by_customer",
        metadata: {
          scope: "event_post",
          eventId: payment.eventId,
          paymentId: payment.id,
          reason,
        },
      },
      {
        idempotencyKey: `event-payment-refund:${payment.id}:${payment.stripeRefundId ?? "initial"}`,
      },
    );

    return persistEventRefund(payment, refund);
  } catch (error) {
    const current = await updateNonterminalRefundState(payment.id, {
      status: "REFUND_FAILED",
      failureReason: compactError(error),
    });
    if (current?.status === "REFUNDED") return current;
    throw error;
  }
}

export async function syncEventPaymentFromCheckoutSession(
  sessionId,
  expectedUserId = null,
  expectedEventId = null,
) {
  if (!sessionId || !isStripeConfigured()) return false;

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price", "payment_intent"],
  });
  const paymentId = session.metadata?.paymentId;

  if (!paymentId) return false;

  const payment = await prisma.eventPayment.findUnique({
    where: { id: paymentId },
  });

  if (
    !payment ||
    (expectedUserId && payment.userId !== expectedUserId) ||
    (expectedEventId && payment.eventId !== expectedEventId)
  ) {
    return false;
  }

  if (session.status === "expired" && !FINAL_PAYMENT_STATUSES.has(payment.status)) {
    await prisma.eventPayment.updateMany({
      where: { id: payment.id, status: { in: ["CREATED", "PROCESSING", "FAILED"] } },
      data: { status: "EXPIRED", failureReason: "Stripe Checkout expired before payment." },
    });
    return false;
  }

  const { paymentIntentId } = assertEventCheckoutSession(session, payment);
  const result = await withSerializableRetry(async (tx) => {
    const current = await tx.eventPayment.findUnique({
      where: { id: payment.id },
    });

    if (!current) return { outcome: "missing" };
    if (current.status === "PAID") return { outcome: "already_paid" };
    if (["REFUNDED", "DISPUTED"].includes(current.status)) {
      return { outcome: "final" };
    }

    if (["REFUND_PENDING", "REFUND_FAILED"].includes(current.status)) {
      await tx.eventPayment.update({
        where: { id: current.id },
        data: {
          status: "REFUND_PENDING",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: current.paidAt ?? new Date(),
        },
      });
      return {
        outcome: "refund_required",
        paymentId: current.id,
        reason: current.failureReason ?? "Payment could not be applied to this event.",
      };
    }

    const [event, existingPaid] = await Promise.all([
      tx.event.findUnique({
        where: { id: current.eventId },
        select: {
          id: true,
          creatorId: true,
          postingMethod: true,
          status: true,
          startDate: true,
          endDate: true,
          cancellationReason: true,
        },
      }),
      tx.eventPayment.findFirst({
        where: {
          eventId: current.eventId,
          id: { not: current.id },
          status: "PAID",
        },
        select: { id: true },
      }),
    ]);

    if (existingPaid) {
      await tx.eventPayment.update({
        where: { id: current.id },
        data: {
          status: "REFUND_PENDING",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
          failureReason: "Duplicate paid Checkout attempt.",
        },
      });
      return { outcome: "duplicate", paymentId: current.id };
    }

    const scheduleMatchesPurchase = Boolean(
      event &&
      event.startDate?.getTime() === current.eventStartDate?.getTime() &&
      event.endDate?.getTime() === current.eventEndDate?.getTime()
    );
    const cancellationKeepsPayment = shouldKeepSettledPaymentForCancelledEvent(
      event,
      current,
    );

    if (cancellationKeepsPayment) {
      await tx.eventPayment.update({
        where: { id: current.id },
        data: {
          status: "PAID",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: current.paidAt ?? new Date(),
          failureReason: "Payment settled before an organizer or admin cancellation completed.",
        },
      });
      return { outcome: "cancelled_without_refund" };
    }

    const eventIsEligible = Boolean(
      event &&
      event.creatorId === current.userId &&
      event.postingMethod === "ONE_TIME" &&
      event.status === "DRAFT" &&
      scheduleMatchesPurchase &&
      event.endDate &&
      event.endDate > new Date(),
    );

    if (!eventIsEligible) {
      await tx.eventPayment.update({
        where: { id: current.id },
        data: {
          status: "REFUND_PENDING",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
          failureReason: "The event was canceled, changed, or ended before payment settled.",
        },
      });
      return {
        outcome: "refund_required",
        paymentId: current.id,
        reason: "Payment settled after the event was no longer eligible.",
      };
    }

    const eventTransition = await tx.event.updateMany({
      where: {
        id: current.eventId,
        creatorId: current.userId,
        postingMethod: "ONE_TIME",
        status: "DRAFT",
        startDate: current.eventStartDate,
        endDate: current.eventEndDate,
      },
      data: { status: "PENDING" },
    });

    if (eventTransition.count !== 1) {
      await tx.eventPayment.update({
        where: { id: current.id },
        data: {
          status: "REFUND_PENDING",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          paidAt: new Date(),
          failureReason: "The event changed while payment was settling.",
        },
      });
      return {
        outcome: "refund_required",
        paymentId: current.id,
        reason: "The event changed while payment was settling.",
      };
    }

    await tx.eventPayment.update({
      where: { id: current.id },
      data: {
        status: "PAID",
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
        failureReason: null,
      },
    });
    return { outcome: "fulfilled" };
  });

  if (["duplicate", "refund_required"].includes(result.outcome)) {
    await refundEventPayment(
      result.paymentId,
      result.reason ?? "Duplicate paid Checkout attempt",
    );
  }

  return ["fulfilled", "already_paid", "cancelled_without_refund"].includes(
    result.outcome,
  );
}

export async function handleEventCheckoutSessionFailure(session, status) {
  const paymentId = session.metadata?.paymentId;
  if (!paymentId) return false;

  const nextStatus = status === "expired" ? "EXPIRED" : "FAILED";
  const result = await prisma.eventPayment.updateMany({
    where: {
      id: paymentId,
      OR: [
        { stripeCheckoutSessionId: session.id },
        { stripeCheckoutSessionId: null },
      ],
      status: { in: ["CREATED", "PROCESSING", "FAILED", "EXPIRED"] },
    },
    data: {
      status: nextStatus,
      stripeCheckoutSessionId: session.id,
      failureReason: status === "expired"
        ? "Stripe Checkout expired before payment."
        : "Stripe reported that the event payment failed.",
    },
  });

  return result.count > 0;
}

export async function denyEventAndRefund(eventId) {
  const paymentIdsToRefund = await withSerializableRetry(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        postingMethod: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    if (!event) throw new Error("Event not found.");
    if (event.status !== "PENDING") {
      throw new Error("Only a pending event can be denied.");
    }

    const shouldRefund = Boolean(
      event.postingMethod === "ONE_TIME" &&
      !event.publishedAt,
    );

    const denied = await tx.event.updateMany({
      where: {
        id: eventId,
        status: "PENDING",
        publishedAt: event.publishedAt,
        updatedAt: event.updatedAt,
      },
      data: { status: "DENIED" },
    });
    if (denied.count !== 1) {
      throw paymentConcurrencyError("The event changed while it was being denied.");
    }

    if (!shouldRefund) return [];

    const payments = await tx.eventPayment.findMany({
      where: {
        eventId,
        status: { in: ["PAID", "REFUND_FAILED", "REFUND_PENDING"] },
      },
      orderBy: { paidAt: "desc" },
      select: { id: true },
    });
    if (payments.length === 0) return [];

    await tx.eventPayment.updateMany({
      where: { id: { in: payments.map((payment) => payment.id) } },
      data: { status: "REFUND_PENDING", failureReason: null },
    });
    return payments.map((payment) => payment.id);
  });

  const results = await Promise.allSettled(
    paymentIdsToRefund.map((paymentId) =>
      refundEventPayment(paymentId, "Event submission denied")
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    throw new AggregateError(
      failed.map((result) => result.reason),
      "One or more event refunds failed.",
    );
  }

  return results;
}

export async function retryEventRefund(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      publishedAt: true,
      cancellationReason: true,
    },
  });
  const refundableStatuses = ["REFUND_FAILED", "REFUND_PENDING"];
  if (canAdminRefundPaidEvent(event)) {
    refundableStatuses.push("PAID");
  }

  const payments = await prisma.eventPayment.findMany({
    where: { eventId, status: { in: refundableStatuses } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (payments.length === 0) {
    throw new Error("No event refund is waiting to be retried.");
  }

  const results = await Promise.allSettled(
    payments.map((payment) => refundEventPayment(payment.id, "Admin refund retry")),
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    throw new AggregateError(
      failed.map((result) => result.reason),
      "One or more event refund retries failed.",
    );
  }

  return results;
}

export async function approveEventForPublication(eventId) {
  return withSerializableRetry(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        payments: {
          where: { status: "PAID" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!event) throw new Error("Event not found.");
    if (event.status !== "PENDING") {
      throw new Error("Only a pending event can be approved.");
    }
    if (!event.endDate || event.endDate <= new Date()) {
      throw new Error("An event that has already ended cannot be published.");
    }
    if (event.postingMethod === "ONE_TIME" && event.payments.length === 0) {
      throw new Error("Stripe payment has not been confirmed for this event.");
    }

    const updated = await tx.event.updateMany({
      where: { id: eventId, status: "PENDING", endDate: { gt: new Date() } },
      data: {
        status: "PUBLISHED",
        publishedAt: event.publishedAt ?? new Date(),
        cancelledAt: null,
        cancellationReason: null,
      },
    });
    if (updated.count !== 1) {
      throw new Error("The event changed while it was being approved.");
    }

    return tx.event.findUnique({ where: { id: eventId } });
  });
}

export async function handleEventChargeRefunded(charge) {
  const paymentIntentId = getObjectId(charge.payment_intent);
  if (!paymentIntentId || charge.amount_refunded < charge.amount) return false;

  return withSerializableRetry(async (tx) => {
    const payment = await tx.eventPayment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!payment) return false;

    if (payment.status !== "REFUNDED") {
      const refunded = await tx.eventPayment.updateMany({
        where: {
          id: payment.id,
          status: { not: "REFUNDED" },
          updatedAt: payment.updatedAt,
        },
        data: {
          status: "REFUNDED",
          refundedAmountCents: Math.max(
            payment.refundedAmountCents ?? 0,
            charge.amount_refunded,
          ),
          refundedAt: payment.refundedAt ?? new Date(),
          failureReason: null,
        },
      });
      if (refunded.count !== 1) {
        throw paymentConcurrencyError(
          "The payment changed while Stripe's full refund was being recorded.",
        );
      }
    }

    const otherPaid = await tx.eventPayment.count({
      where: { eventId: payment.eventId, id: { not: payment.id }, status: "PAID" },
    });
    if (otherPaid === 0) {
      await tx.event.updateMany({
        where: { id: payment.eventId, status: { not: "DENIED" } },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "PAYMENT_REFUND",
        },
      });
    }

    return true;
  });
}

export async function handleEventChargeDispute(charge, disputeStatus, disputeId) {
  const paymentIntentId = getObjectId(charge.payment_intent);
  if (
    !paymentIntentId ||
    !disputeStatus ||
    !disputeId ||
    isTerminalEventDisputeStatus(disputeStatus)
  ) {
    return false;
  }

  const payment = await prisma.eventPayment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment) return false;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["PAID", "DISPUTED"] },
        OR: [
          { stripeDisputeStatus: null },
          {
            stripeDisputeStatus: {
              notIn: TERMINAL_EVENT_DISPUTE_STATUSES,
            },
          },
        ],
      },
      data: {
        status: "DISPUTED",
        stripeDisputeId: disputeId,
        stripeDisputeStatus: disputeStatus,
        failureReason: "Stripe payment dispute opened.",
      },
    });

    if (updated.count !== 1) return false;

    await tx.event.updateMany({
      where: {
        id: payment.eventId,
        status: { in: ["PENDING", "PUBLISHED"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "PAYMENT_DISPUTE",
      },
    });
    return true;
  });
}

export async function handleEventChargeDisputeClosed(
  charge,
  disputeStatus,
  disputeId,
) {
  const paymentIntentId = getObjectId(charge.payment_intent);
  if (
    !paymentIntentId ||
    !disputeId ||
    !isTerminalEventDisputeStatus(disputeStatus)
  ) {
    return false;
  }

  const payment = await prisma.eventPayment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!payment) return false;

  const favorable = isFavorableEventDisputeStatus(disputeStatus);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["PAID", "DISPUTED"] },
        OR: [
          { stripeDisputeStatus: null },
          {
            stripeDisputeStatus: {
              notIn: TERMINAL_EVENT_DISPUTE_STATUSES,
            },
          },
        ],
      },
      data: {
        status: favorable ? "PAID" : "DISPUTED",
        stripeDisputeId: disputeId,
        stripeDisputeStatus: disputeStatus,
        failureReason: favorable
          ? "Stripe closed the dispute without a customer loss."
          : "Stripe closed the dispute in the customer's favor.",
      },
    });

    if (updated.count !== 1) return false;

    if (favorable) {
      await tx.event.updateMany({
        where: {
          id: payment.eventId,
          status: "CANCELLED",
          cancellationReason: "PAYMENT_DISPUTE",
          endDate: { gt: new Date() },
        },
        data: {
          status: "PENDING",
          cancelledAt: null,
          cancellationReason: null,
        },
      });
    } else {
      await tx.event.updateMany({
        where: {
          id: payment.eventId,
          status: { in: ["PENDING", "PUBLISHED"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "PAYMENT_DISPUTE",
        },
      });
    }

    return true;
  });
}

export async function handleEventRefundUpdated(refund) {
  const paymentIntentId = getObjectId(refund.payment_intent);
  if (!paymentIntentId) return false;

  const payment = await prisma.eventPayment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (
    !payment ||
    ![
      "PAID",
      "DISPUTED",
      "REFUND_PENDING",
      "REFUNDED",
      "REFUND_FAILED",
    ].includes(payment.status)
  ) {
    return false;
  }

  await persistEventRefund(payment, refund);
  return true;
}

async function resolveCheckoutBeforeCancellation(attempt) {
  const stripe = getStripe();
  let session = await stripe.checkout.sessions.retrieve(
    attempt.stripeCheckoutSessionId,
  );

  if (session.payment_status === "paid") {
    const synced = await syncEventPaymentFromCheckoutSession(
      session.id,
      attempt.userId,
      attempt.eventId,
    );
    if (!synced) {
      throw new Error("Stripe confirmed payment, but the event payment could not be recorded.");
    }
    return;
  }

  if (session.status === "expired") return;

  if (session.status === "open") {
    try {
      await stripe.checkout.sessions.expire(session.id);
      return;
    } catch (error) {
      session = await stripe.checkout.sessions.retrieve(session.id);
      if (session.payment_status === "paid") {
        const synced = await syncEventPaymentFromCheckoutSession(
          session.id,
          attempt.userId,
          attempt.eventId,
        );
        if (!synced) throw error;
        return;
      }
      if (session.status === "expired") return;
      throw error;
    }
  }

  throw new Error(
    "This event payment is still processing. Wait for Stripe to finish before canceling.",
  );
}

export async function cancelEventPosting(eventId, reason = "ORGANIZER") {
  if (!DIRECT_CANCELLATION_REASONS.has(reason)) {
    throw new Error("Invalid event cancellation reason.");
  }

  if (isStripeConfigured()) {
    const knownAttempts = await prisma.eventPayment.findMany({
      where: {
        eventId,
        status: { in: ["CREATED", "PROCESSING"] },
        stripeCheckoutSessionId: { not: null },
      },
      select: {
        eventId: true,
        userId: true,
        stripeCheckoutSessionId: true,
      },
    });

    for (const attempt of knownAttempts) {
      await resolveCheckoutBeforeCancellation(attempt);
    }
  }

  const remainingAttempts = await withSerializableRetry(async (tx) => {
    const attempts = await tx.eventPayment.findMany({
      where: {
        eventId,
        status: { in: ["CREATED", "PROCESSING"] },
      },
      select: {
        eventId: true,
        userId: true,
        stripeCheckoutSessionId: true,
      },
    });

    await tx.event.update({
      where: { id: eventId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    await tx.eventPayment.updateMany({
      where: { eventId, status: { in: ["CREATED", "PROCESSING"] } },
      data: {
        status: "EXPIRED",
        failureReason: "Event canceled before payment completed.",
      },
    });

    return attempts.filter((attempt) => attempt.stripeCheckoutSessionId);
  });

  if (isStripeConfigured()) {
    for (const attempt of remainingAttempts) {
      try {
        await resolveCheckoutBeforeCancellation(attempt);
      } catch (error) {
        console.error(
          `[events] Checkout ${attempt.stripeCheckoutSessionId} could not be finalized after cancellation:`,
          error,
        );
      }
    }
  }
}

export async function expireOpenEventCheckoutSessions(
  eventId,
  reason = "Event details changed before payment completed.",
) {
  const attempts = await prisma.eventPayment.findMany({
    where: {
      eventId,
      status: { in: ["CREATED", "PROCESSING"] },
      stripeCheckoutSessionId: { not: null },
    },
    select: { id: true, stripeCheckoutSessionId: true },
  });

  if (attempts.length === 0) return;

  await prisma.eventPayment.updateMany({
    where: {
      id: { in: attempts.map((attempt) => attempt.id) },
      status: { in: ["CREATED", "PROCESSING"] },
    },
    data: { status: "EXPIRED", failureReason: reason },
  });

  if (isStripeConfigured()) {
    await Promise.allSettled(
      attempts.map((attempt) =>
        getStripe().checkout.sessions.expire(attempt.stripeCheckoutSessionId)
      ),
    );
  }
}
