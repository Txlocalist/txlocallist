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
  EVENT_POST_CHECKOUT_DISCLOSURE,
  EVENT_POST_PRICE_CENTS,
  isEventPostingEnabled,
  validateEventPostPrice,
} from "@/lib/pricing";
import { getSiteUrl, getStripe, isStripeConfigured } from "@/lib/stripe";

export { assertEventCheckoutSession } from "@/lib/event-checkout-validation";

const FINAL_PAYMENT_STATUSES = new Set(["PAID", "REFUNDED", "DISPUTED"]);
const ACTIVE_CHECKOUT_STATUSES = ["CREATED", "PROCESSING"];
const REFUND_REQUIRED_PAYMENT_STATUSES = new Set([
  "REFUND_PENDING",
  "REFUND_FAILED",
]);
const TERMINAL_STRIPE_REFUND_STATUSES = new Set([
  "failed",
  "canceled",
  "succeeded",
]);
const CHECKOUT_TTL_SECONDS = 31 * 60;
const DIRECT_CANCELLATION_REASONS = new Set(["ORGANIZER", "ADMIN"]);
const checkoutCreationPromises = new Map();

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

function isSameStripeRefund(current, refund) {
  return Boolean(
    current.stripeRefundId &&
    refund.id &&
    current.stripeRefundId === refund.id
  );
}

function wouldRegressTerminalStripeRefund(current, refund) {
  if (
    !isSameStripeRefund(current, refund) ||
    !TERMINAL_STRIPE_REFUND_STATUSES.has(current.stripeRefundStatus)
  ) {
    return false;
  }

  if (current.stripeRefundStatus === "succeeded") {
    return refund.status !== "succeeded";
  }

  return !TERMINAL_STRIPE_REFUND_STATUSES.has(refund.status);
}

function isFullRefundForPayment(refund, payment) {
  return Boolean(
    refund.status === "succeeded" &&
    (refund.amount ?? 0) >= payment.amountCents &&
    getObjectId(refund.payment_intent) === payment.stripePaymentIntentId &&
    refund.currency === payment.currency
  );
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

async function persistEventRefund(
  payment,
  refund,
  { allowNewAttempt = false } = {},
) {
  const refundedAmountCents = await getRefundedAmountCents(payment, refund);
  const stripeRefundCreatedAt = getStripeObjectCreatedAt(refund.created);

  return withSerializableRetry(async (tx) => {
    const current = await tx.eventPayment.findUnique({ where: { id: payment.id } });
    if (!current) return current;

    const sameRefund = isSameStripeRefund(current, refund);
    const differentTrackedRefund = Boolean(
      current.stripeRefundId &&
      refund.id &&
      current.stripeRefundId !== refund.id
    );
    const fullRefundForPayment = isFullRefundForPayment(refund, current);

    if (
      current.status === "REFUNDED" &&
      (
        !fullRefundForPayment ||
        (current.stripeRefundId && !sameRefund)
      )
    ) {
      return current;
    }

    if (wouldRegressTerminalStripeRefund(current, refund)) {
      return current;
    }

    const totalRefundedCents = Math.max(
      current.refundedAmountCents ?? 0,
      refundedAmountCents,
    );
    const fullRefundAdvancesAggregate = Boolean(
      fullRefundForPayment &&
      totalRefundedCents >= current.amountCents &&
      totalRefundedCents > (current.refundedAmountCents ?? 0)
    );
    if (
      differentTrackedRefund &&
      !allowNewAttempt &&
      current.stripeRefundCreatedAt &&
      current.stripeRefundCreatedAt >= stripeRefundCreatedAt &&
      !fullRefundAdvancesAggregate
    ) {
      return current;
    }

    const nextStatus = current.status === "REFUNDED"
      ? "REFUNDED"
      : getRefundPaymentStatus(refund, current, totalRefundedCents);
    const refundData = {
      stripeRefundId: refund.id,
      stripeRefundStatus: refund.status,
      stripeRefundCreatedAt,
      refundedAmountCents: totalRefundedCents,
    };
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: current.id,
        updatedAt: current.updatedAt,
      },
      data: current.status === "REFUNDED"
        ? refundData
        : {
          ...refundData,
          status: nextStatus,
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

    if (nextStatus === "REFUNDED" && current.status !== "REFUNDED") {
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

async function resolveEventPaymentForPaymentIntent(paymentIntentId) {
  const linkedPayment = await prisma.eventPayment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (linkedPayment) return linkedPayment;

  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent?.metadata?.scope !== "event_post") return null;

  const paymentId = paymentIntent.metadata.paymentId;
  const payment = paymentId
    ? await prisma.eventPayment.findUnique({ where: { id: paymentId } })
    : null;
  const paymentIntentCustomerId = getObjectId(paymentIntent.customer);
  const correlationIsValid = Boolean(
    payment &&
    paymentIntent.id === paymentIntentId &&
    paymentIntent.metadata.eventId === payment.eventId &&
    paymentIntent.metadata.userId === payment.userId &&
    paymentIntent.amount === payment.amountCents &&
    paymentIntent.currency === payment.currency &&
    (
      !payment.stripeCustomerId ||
      paymentIntentCustomerId === payment.stripeCustomerId
    )
  );

  if (!correlationIsValid) {
    throw new Error(
      `Stripe PaymentIntent ${paymentIntentId} could not be safely correlated to an event payment.`,
    );
  }

  const linked = await prisma.eventPayment.updateMany({
    where: {
      id: payment.id,
      OR: [
        { stripePaymentIntentId: null },
        { stripePaymentIntentId: paymentIntentId },
      ],
    },
    data: { stripePaymentIntentId: paymentIntentId },
  });
  if (linked.count !== 1) {
    throw paymentConcurrencyError(
      "The Stripe PaymentIntent was linked to a different payment concurrently.",
    );
  }

  return prisma.eventPayment.findUnique({ where: { id: payment.id } });
}

async function inspectExistingCheckoutAttempt(attempt, expectedUserId) {
  if (!attempt?.stripeCheckoutSessionId) return null;

  const session = await getStripe().checkout.sessions.retrieve(
    attempt.stripeCheckoutSessionId,
  );
  if (
    session.metadata?.scope !== "event_post" ||
    session.metadata?.paymentId !== attempt.id ||
    session.metadata?.eventId !== attempt.eventId ||
    session.metadata?.userId !== expectedUserId
  ) {
    throw new Error("The existing Stripe Checkout Session has invalid metadata.");
  }

  if (session.status === "open") {
    if (!session.url) {
      throw new Error("The existing Stripe Checkout Session is not available.");
    }

    await prisma.eventPayment.updateMany({
      where: {
        id: attempt.id,
        status: { in: ["CREATED", "EXPIRED"] },
      },
      data: {
        status: "PROCESSING",
        failureReason: null,
      },
    });
    return session;
  }

  if (session.payment_status === "paid") {
    await syncEventPaymentFromCheckoutSession(session.id, expectedUserId);
    throw new Error("This event payment has already completed.");
  }

  if (session.status === "complete") {
    await prisma.eventPayment.updateMany({
      where: {
        id: attempt.id,
        status: { in: ["CREATED", "PROCESSING", "EXPIRED"] },
      },
      data: {
        status: "PROCESSING",
        failureReason: "Stripe is still processing this event payment.",
      },
    });
    throw new Error(
      "This event payment is still processing. Wait for Stripe to finish before trying again.",
    );
  }

  if (session.status === "expired") {
    await prisma.eventPayment.updateMany({
      where: { id: attempt.id, status: { in: ACTIVE_CHECKOUT_STATUSES } },
      data: {
        status: "EXPIRED",
        failureReason: "Stripe Checkout expired before payment.",
      },
    });
    return null;
  }

  throw new Error(
    "The existing event payment has not reached a safe retry state.",
  );
}

async function reserveEventPayment({ event, userId, priceId, customerId }) {
  const checkoutExpiresAt = new Date(
    (Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS) * 1000,
  );
  const data = {
    eventId: event.id,
    userId,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
    amountCents: EVENT_POST_PRICE_CENTS,
    currency: BILLING_CURRENCY,
    eventStartDate: event.startDate,
    eventEndDate: event.endDate,
    checkoutExpiresAt,
    status: "CREATED",
  };

  try {
    return {
      payment: await prisma.eventPayment.create({ data }),
      created: true,
    };
  } catch (error) {
    if (error?.code !== "P2002") throw error;

    const activePayment = await prisma.eventPayment.findFirst({
      where: {
        eventId: event.id,
        status: { in: ACTIVE_CHECKOUT_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!activePayment || activePayment.userId !== userId) throw error;
    return { payment: activePayment, created: false };
  }
}

async function ensureCheckoutReservationExpiry(payment) {
  if (payment.checkoutExpiresAt instanceof Date) return payment;

  const checkoutExpiresAt = new Date(
    (Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS) * 1000,
  );
  await prisma.eventPayment.updateMany({
    where: {
      id: payment.id,
      status: { in: ACTIVE_CHECKOUT_STATUSES },
      checkoutExpiresAt: null,
    },
    data: { checkoutExpiresAt },
  });

  return prisma.eventPayment.findUnique({ where: { id: payment.id } });
}

async function findStripeCheckoutSessionForPayment(payment) {
  if (!payment.stripeCustomerId) {
    throw new Error("The event payment reservation has no Stripe customer.");
  }

  let startingAfter;
  let fullyScanned = false;
  const matchingSessions = [];
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await getStripe().checkout.sessions.list({
      customer: payment.stripeCustomerId,
      created: payment.createdAt instanceof Date
        ? { gte: Math.max(0, Math.floor(payment.createdAt.getTime() / 1000) - 300) }
        : undefined,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    matchingSessions.push(...page.data.filter((session) =>
      session.mode === "payment" &&
      session.metadata?.scope === "event_post" &&
      session.metadata?.paymentId === payment.id &&
      session.metadata?.eventId === payment.eventId &&
      session.metadata?.userId === payment.userId
    ));
    if (!page.has_more || page.data.length === 0) {
      fullyScanned = true;
      break;
    }
    startingAfter = page.data.at(-1).id;
  }

  if (!fullyScanned) {
    throw new Error(
      "Stripe returned too many Checkout Sessions to safely reconcile this payment.",
    );
  }
  if (matchingSessions.length > 1) {
    throw new Error(
      "Multiple Stripe Checkout Sessions exist for one event payment reservation.",
    );
  }
  return matchingSessions[0] ?? null;
}

async function recoverSessionlessCheckoutReservation(payment) {
  const stripeSession = await findStripeCheckoutSessionForPayment(payment);
  if (stripeSession) {
    const linked = await prisma.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: { in: ACTIVE_CHECKOUT_STATUSES },
        stripeCheckoutSessionId: null,
      },
      data: {
        status: "PROCESSING",
        stripeCheckoutSessionId: stripeSession.id,
        checkoutExpiresAt: stripeSession.expires_at
          ? new Date(stripeSession.expires_at * 1000)
          : payment.checkoutExpiresAt,
      },
    });
    if (linked.count !== 1) {
      const current = await prisma.eventPayment.findUnique({
        where: { id: payment.id },
      });
      if (current?.stripeCheckoutSessionId !== stripeSession.id) {
        throw paymentConcurrencyError(
          "The event payment reservation changed during Stripe reconciliation.",
        );
      }
      return { payment: current, session: stripeSession, released: false };
    }

    return {
      payment: await prisma.eventPayment.findUnique({ where: { id: payment.id } }),
      session: stripeSession,
      released: false,
    };
  }

  if (
    payment.checkoutExpiresAt instanceof Date &&
    payment.checkoutExpiresAt <= new Date()
  ) {
    const released = await prisma.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: { in: ACTIVE_CHECKOUT_STATUSES },
        stripeCheckoutSessionId: null,
        checkoutExpiresAt: { lte: new Date() },
      },
      data: {
        status: "FAILED",
        failureReason: "No Stripe Checkout Session existed before the reservation expired.",
      },
    });
    if (released.count === 1) {
      return { payment: null, session: null, released: true };
    }
  }

  return { payment, session: null, released: false };
}

async function createEventCheckoutSessionInternal({ eventId, userId }) {
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

  let existingAttempt = await prisma.eventPayment.findFirst({
    where: {
      eventId,
      userId,
      status: { in: ACTIVE_CHECKOUT_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingAttempt?.stripeCheckoutSessionId) {
    const existingSession = await inspectExistingCheckoutAttempt(
      existingAttempt,
      userId,
    );
    if (existingSession) return existingSession;
    existingAttempt = null;
  }

  const legacyAttempts = await prisma.eventPayment.findMany({
    where: {
      eventId,
      userId,
      status: "EXPIRED",
      stripeCheckoutSessionId: { not: null },
      failureReason: "Checkout session closed before payment.",
    },
    orderBy: { createdAt: "desc" },
  });
  for (const legacyAttempt of legacyAttempts) {
    const existingSession = await inspectExistingCheckoutAttempt(
      legacyAttempt,
      userId,
    );
    if (existingSession) return existingSession;
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
  let reservation = existingAttempt
    ? { payment: existingAttempt, created: false }
    : await reserveEventPayment({ event, userId, priceId, customerId });
  let payment;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    payment = await ensureCheckoutReservationExpiry(reservation.payment);
    if (!payment) {
      throw paymentConcurrencyError("The active event payment reservation disappeared.");
    }

    if (payment.stripeCheckoutSessionId) {
      const existingSession = await inspectExistingCheckoutAttempt(payment, userId);
      if (existingSession) return existingSession;
      reservation = await reserveEventPayment({ event, userId, priceId, customerId });
      continue;
    }

    if (!reservation.created) {
      const recovery = await recoverSessionlessCheckoutReservation(payment);
      if (recovery.session) {
        const existingSession = await inspectExistingCheckoutAttempt(
          recovery.payment,
          userId,
        );
        if (existingSession) return existingSession;
        reservation = await reserveEventPayment({
          event,
          userId,
          priceId,
          customerId,
        });
        continue;
      }
      if (recovery.released) {
        reservation = await reserveEventPayment({
          event,
          userId,
          priceId,
          customerId,
        });
        continue;
      }
      payment = recovery.payment;
    }

    break;
  }

  if (!payment || !ACTIVE_CHECKOUT_STATUSES.includes(payment.status)) {
    throw paymentConcurrencyError(
      "The event payment reservation could not be prepared safely.",
    );
  }

  const reservationMatchesRequest = Boolean(
    payment.eventId === eventId &&
    payment.userId === userId &&
    payment.stripePriceId === priceId &&
    payment.stripeCustomerId === customerId &&
    payment.amountCents === EVENT_POST_PRICE_CENTS &&
    payment.currency === BILLING_CURRENCY &&
    payment.checkoutExpiresAt instanceof Date &&
    payment.eventStartDate?.getTime() === event.startDate?.getTime() &&
    payment.eventEndDate?.getTime() === event.endDate?.getTime()
  );
  if (!reservationMatchesRequest) {
    throw new Error("The active event payment reservation no longer matches this event.");
  }

  try {
    const siteUrl = getSiteUrl();
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: payment.stripeCustomerId,
        client_reference_id: userId,
        success_url: `${siteUrl}/dashboard/events/${eventId}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/dashboard/events/${eventId}/checkout/cancel`,
        line_items: [{ price: payment.stripePriceId, quantity: 1 }],
        automatic_tax: { enabled: false },
        custom_text: {
          submit: { message: EVENT_POST_CHECKOUT_DISCLOSURE },
        },
        expires_at: Math.floor(payment.checkoutExpiresAt.getTime() / 1000),
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
        where: {
          id: payment.id,
          status: { in: ACTIVE_CHECKOUT_STATUSES },
          OR: [
            { stripeCheckoutSessionId: null },
            { stripeCheckoutSessionId: session.id },
          ],
        },
        data: {
          status: "PROCESSING",
          stripeCheckoutSessionId: session.id,
          checkoutExpiresAt: session.expires_at
            ? new Date(session.expires_at * 1000)
            : null,
          failureReason: null,
        },
      });
      if (updated.count === 1) return true;

      const currentPayment = await tx.eventPayment.findUnique({
        where: { id: payment.id },
      });
      return Boolean(
        currentPayment?.status === "PROCESSING" &&
        currentPayment.stripeCheckoutSessionId === session.id
      );
    });

    if (!activated) {
      await getStripe().checkout.sessions.expire(session.id).catch(() => null);
      await prisma.eventPayment.updateMany({
        where: { id: payment.id, status: { in: ACTIVE_CHECKOUT_STATUSES } },
        data: {
          status: "FAILED",
          failureReason: "The event changed before Checkout could open.",
        },
      });
      throw new Error("The event changed before Checkout could open.");
    }

    return session;
  } catch (error) {
    await prisma.eventPayment.updateMany({
      where: {
        id: payment.id,
        status: "CREATED",
        stripeCheckoutSessionId: null,
      },
      data: { failureReason: compactError(error) },
    }).catch(() => null);
    throw error;
  }
}

export function createEventCheckoutSession({ eventId, userId }) {
  const coordinationKey = `${eventId}:${userId}`;
  const activePromise = checkoutCreationPromises.get(coordinationKey);
  if (activePromise) return activePromise;

  const creationPromise = createEventCheckoutSessionInternal({ eventId, userId })
    .finally(() => {
      if (checkoutCreationPromises.get(coordinationKey) === creationPromise) {
        checkoutCreationPromises.delete(coordinationKey);
      }
    });
  checkoutCreationPromises.set(coordinationKey, creationPromise);
  return creationPromise;
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

    return persistEventRefund(payment, refund, { allowNewAttempt: true });
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

export async function handleEventCheckoutSessionProcessing(session) {
  const paymentId = session.metadata?.paymentId;
  if (
    session.metadata?.scope !== "event_post" ||
    !paymentId ||
    session.status !== "complete" ||
    session.payment_status === "paid"
  ) {
    return false;
  }

  const result = await prisma.eventPayment.updateMany({
    where: {
      id: paymentId,
      eventId: session.metadata.eventId,
      userId: session.metadata.userId,
      OR: [
        { stripeCheckoutSessionId: session.id },
        { stripeCheckoutSessionId: null },
      ],
      status: { in: ["CREATED", "PROCESSING", "EXPIRED"] },
    },
    data: {
      status: "PROCESSING",
      stripeCheckoutSessionId: session.id,
      checkoutExpiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
      failureReason: "Stripe is still processing this event payment.",
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

    const shouldRefund = event.postingMethod === "ONE_TIME";

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

  const resolvedPayment = await resolveEventPaymentForPaymentIntent(paymentIntentId);
  if (!resolvedPayment) return false;

  return withSerializableRetry(async (tx) => {
    const payment = await tx.eventPayment.findUnique({
      where: { id: resolvedPayment.id },
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

  const payment = await resolveEventPaymentForPaymentIntent(paymentIntentId);
  if (!payment) return false;

  return prisma.$transaction(async (tx) => {
    const current = await tx.eventPayment.findUnique({
      where: { id: payment.id },
    });
    if (!current || current.status === "REFUNDED") return false;

    const refundMustContinue = REFUND_REQUIRED_PAYMENT_STATUSES.has(
      current.status,
    );
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: current.id,
        status: { not: "REFUNDED" },
        updatedAt: current.updatedAt,
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
        status: refundMustContinue ? current.status : "DISPUTED",
        stripeDisputeId: disputeId,
        stripeDisputeStatus: disputeStatus,
        failureReason: refundMustContinue
          ? current.failureReason
          : "Stripe payment dispute opened.",
      },
    });

    if (updated.count !== 1) return false;

    await tx.event.updateMany({
      where: {
        id: payment.eventId,
        status: { in: ["DRAFT", "PENDING", "PUBLISHED"] },
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

  const payment = await resolveEventPaymentForPaymentIntent(paymentIntentId);
  if (!payment) return false;

  const favorable = isFavorableEventDisputeStatus(disputeStatus);
  return prisma.$transaction(async (tx) => {
    const current = await tx.eventPayment.findUnique({
      where: { id: payment.id },
    });
    if (!current || current.status === "REFUNDED") return false;

    const refundMustContinue = favorable &&
      REFUND_REQUIRED_PAYMENT_STATUSES.has(current.status);
    const wasValidatedAsPaid = !refundMustContinue && Boolean(current.paidAt);
    const nextStatus = refundMustContinue
      ? current.status
      : favorable
      ? wasValidatedAsPaid
        ? "PAID"
        : current.stripeCheckoutSessionId
          ? "PROCESSING"
          : "CREATED"
      : "DISPUTED";
    const updated = await tx.eventPayment.updateMany({
      where: {
        id: current.id,
        status: { not: "REFUNDED" },
        updatedAt: current.updatedAt,
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
        status: nextStatus,
        stripeDisputeId: disputeId,
        stripeDisputeStatus: disputeStatus,
        failureReason: refundMustContinue
          ? current.failureReason
          : favorable
          ? wasValidatedAsPaid
            ? "Stripe closed the dispute without a customer loss."
            : null
          : "Stripe closed the dispute in the customer's favor.",
      },
    });

    if (updated.count !== 1) return false;

    if (favorable && !refundMustContinue) {
      await tx.event.updateMany({
        where: {
          id: payment.eventId,
          status: "CANCELLED",
          cancellationReason: "PAYMENT_DISPUTE",
          endDate: { gt: new Date() },
        },
        data: {
          status: wasValidatedAsPaid ? "PENDING" : "DRAFT",
          cancelledAt: null,
          cancellationReason: null,
        },
      });
    } else {
      await tx.event.updateMany({
        where: {
          id: payment.eventId,
          status: { in: ["DRAFT", "PENDING", "PUBLISHED"] },
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

  const payment = await resolveEventPaymentForPaymentIntent(paymentIntentId);
  if (
    !payment ||
    ![
      "CREATED",
      "PROCESSING",
      "FAILED",
      "EXPIRED",
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
        OR: [
          { status: { in: ACTIVE_CHECKOUT_STATUSES } },
          {
            status: "EXPIRED",
            failureReason: "Checkout session closed before payment.",
            stripeCheckoutSessionId: { not: null },
          },
        ],
      },
    });

    for (const attempt of knownAttempts) {
      let resolvedAttempt = attempt;
      if (
        ACTIVE_CHECKOUT_STATUSES.includes(attempt.status) &&
        !attempt.stripeCheckoutSessionId
      ) {
        resolvedAttempt = await ensureCheckoutReservationExpiry(attempt);
        const recovery = await recoverSessionlessCheckoutReservation(
          resolvedAttempt,
        );
        if (recovery.released) continue;
        if (!recovery.session) {
          throw new Error(
            "Stripe Checkout is still being prepared. Wait before canceling this event.",
          );
        }
        resolvedAttempt = recovery.payment;
      }

      await resolveCheckoutBeforeCancellation(resolvedAttempt);
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
      status: { in: ACTIVE_CHECKOUT_STATUSES },
    },
  });

  if (attempts.length === 0) return;

  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured, so the active event payment cannot be safely closed.",
    );
  }

  for (const attempt of attempts) {
    let resolvedAttempt = await ensureCheckoutReservationExpiry(attempt);
    if (!resolvedAttempt?.stripeCheckoutSessionId) {
      const recovery = await recoverSessionlessCheckoutReservation(
        resolvedAttempt,
      );
      if (recovery.released) continue;
      if (!recovery.session) {
        throw new Error(
          "Stripe Checkout is still being prepared. Wait before editing this event.",
        );
      }
      resolvedAttempt = recovery.payment;
    }

    await resolveCheckoutBeforeCancellation(resolvedAttempt);
  }

  await prisma.eventPayment.updateMany({
    where: {
      id: { in: attempts.map((attempt) => attempt.id) },
      status: { in: ["CREATED", "PROCESSING"] },
    },
    data: { status: "EXPIRED", failureReason: reason },
  });

}
