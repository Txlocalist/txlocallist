import { getStripe } from "@/lib/stripe";
import { MAX_EVENT_CALENDAR_DAYS } from "@/lib/event-dates";

export const BILLING_CURRENCY = "usd";
export const MEMBERSHIP_PRICE_CENTS = 1000;
export const EVENT_POST_PRICE_CENTS = 1000;
export const EVENT_MAX_CALENDAR_DAYS = MAX_EVENT_CALENDAR_DAYS;

export function formatWholeDollarPrice(priceCents) {
  return `$${(priceCents / 100).toFixed(0)}`;
}

const EVENT_POST_PRICE_LABEL = formatWholeDollarPrice(EVENT_POST_PRICE_CENTS);

export const EVENT_POST_REVIEW_DISCLOSURE =
  `Stripe collects the one-time ${EVENT_POST_PRICE_LABEL} event fee after form validation and before admin review. Payment submits the event for review and does not guarantee publication.`;
export const EVENT_POST_REFUND_DISCLOSURE =
  "Full refunds are automatically initiated for submissions denied by an admin and duplicate charges. Organizer cancellations are not automatically refunded.";
export const EVENT_POST_TAX_DISCLOSURE =
  "Tax is not automatically calculated or collected in Checkout.";
export const EVENT_POST_CHECKOUT_DISCLOSURE = [
  EVENT_POST_REVIEW_DISCLOSURE,
  EVENT_POST_REFUND_DISCLOSURE,
  EVENT_POST_TAX_DISCLOSURE,
].join(" ");

export const PRICING_OFFERS = Object.freeze({
  free: {
    name: "Localist",
    priceCents: 0,
    billingLabel: "Free",
  },
  membership: {
    name: "Local Business Membership",
    priceCents: MEMBERSHIP_PRICE_CENTS,
    billingLabel: "per month",
  },
  eventPost: {
    name: "Event Calendar Post",
    priceCents: EVENT_POST_PRICE_CENTS,
    billingLabel: "one time",
  },
});

export function isEventPostingEnabled() {
  return process.env.EVENT_POSTING_ENABLED?.trim().toLowerCase() === "true";
}

export function getEventPostPriceId() {
  return process.env.STRIPE_PRICE_EVENT_POST?.trim() ?? "";
}

function secretUsesLiveMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function validateStripePriceObject(
  price,
  { amountCents, currency = BILLING_CURRENCY, recurring },
) {
  if (!price?.active) {
    throw new Error("The configured Stripe price is not active.");
  }

  if (price.unit_amount !== amountCents || price.currency !== currency) {
    throw new Error("The configured Stripe price amount or currency is incorrect.");
  }

  if (Boolean(price.recurring) !== recurring) {
    throw new Error("The configured Stripe price has the wrong billing type.");
  }

  if (price.livemode !== secretUsesLiveMode()) {
    throw new Error("The configured Stripe price belongs to the wrong Stripe mode.");
  }

  if (price.product && typeof price.product !== "string" && !price.product.active) {
    throw new Error("The configured Stripe product is not active.");
  }

  return price;
}

export async function retrieveAndValidateStripePrice({
  priceId,
  amountCents,
  recurring,
}) {
  if (!priceId) {
    throw new Error("A required Stripe price ID is not configured.");
  }

  const price = await getStripe().prices.retrieve(priceId, {
    expand: ["product"],
  });

  return validateStripePriceObject(price, {
    amountCents,
    recurring,
  });
}

export async function validateEventPostPrice() {
  const priceId = getEventPostPriceId();

  await retrieveAndValidateStripePrice({
    priceId,
    amountCents: EVENT_POST_PRICE_CENTS,
    recurring: false,
  });

  return priceId;
}
