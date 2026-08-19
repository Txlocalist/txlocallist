import {
  BILLING_CURRENCY,
  EVENT_POST_PRICE_CENTS,
} from "@/lib/pricing";

function getObjectId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function assertEventCheckoutSession(session, payment) {
  const lineItems = session.line_items?.data ?? [];
  const lineItem = lineItems[0];
  const linePriceId = getObjectId(lineItem?.price);
  const paymentIntentId = getObjectId(session.payment_intent);
  const chargedAmountCents = session.amount_total;
  const taxAmountCents = session.total_details?.amount_tax;

  if (
    session.mode !== "payment" ||
    session.metadata?.scope !== "event_post" ||
    session.metadata?.eventId !== payment.eventId ||
    session.metadata?.paymentId !== payment.id ||
    session.metadata?.userId !== payment.userId ||
    session.client_reference_id !== payment.userId ||
    getObjectId(session.customer) !== payment.stripeCustomerId
  ) {
    throw new Error("Stripe Checkout ownership metadata did not match this event payment.");
  }

  if (
    lineItems.length !== 1 ||
    lineItem.quantity !== 1 ||
    linePriceId !== payment.stripePriceId
  ) {
    throw new Error("Stripe Checkout line items did not match the event-posting price.");
  }

  if (
    session.amount_subtotal !== payment.amountCents ||
    payment.amountCents !== EVENT_POST_PRICE_CENTS ||
    !Number.isInteger(chargedAmountCents) ||
    chargedAmountCents < payment.amountCents ||
    !Number.isInteger(taxAmountCents) ||
    taxAmountCents < 0 ||
    chargedAmountCents !== payment.amountCents + taxAmountCents ||
    (
      Number.isInteger(payment.chargedAmountCents) &&
      chargedAmountCents !== payment.chargedAmountCents
    ) ||
    session.currency !== payment.currency ||
    payment.currency !== BILLING_CURRENCY
  ) {
    throw new Error("Stripe Checkout subtotal, tax, or total did not match the event-posting price.");
  }

  if (
    session.automatic_tax?.enabled !== true ||
    session.automatic_tax?.status !== "complete"
  ) {
    throw new Error("Stripe Checkout did not complete automatic tax calculation.");
  }

  if (session.payment_status !== "paid" || !paymentIntentId) {
    throw new Error("Stripe has not confirmed payment for this event post.");
  }

  return { paymentIntentId, chargedAmountCents, taxAmountCents };
}
