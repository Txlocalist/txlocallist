import {
  handleStripeSubscriptionWebhook,
  releaseAccountCheckoutFence,
  syncSubscriptionFromCheckoutSessionId,
} from "@/lib/billing";
import {
  handleEventChargeDispute,
  handleEventChargeDisputeClosed,
  handleEventChargeRefunded,
  handleEventCheckoutSessionFailure,
  handleEventCheckoutSessionProcessing,
  handleEventRefundUpdated,
  syncEventPaymentFromCheckoutSession,
} from "@/lib/event-payments";
import { isTerminalEventDisputeStatus } from "@/lib/event-disputes";
import { getStripe, isStripeWebhookConfigured } from "@/lib/stripe";
import { processStripeWebhookOnce } from "@/lib/stripe-webhooks";

export const runtime = "nodejs";

function errorKind(error) {
  if (!error || typeof error !== "object") return "unknown";
  if (typeof error.type === "string" && error.type) return error.type;
  if (typeof error.name === "string" && error.name) return error.name;
  return "unknown";
}

async function syncEventDispute(disputeId) {
  const stripe = getStripe();
  const dispute = await stripe.disputes.retrieve(disputeId);
  const chargeId = typeof dispute.charge === "string"
    ? dispute.charge
    : dispute.charge?.id;
  if (!chargeId) return false;

  const charge = await stripe.charges.retrieve(chargeId);
  if (isTerminalEventDisputeStatus(dispute.status)) {
    return handleEventChargeDisputeClosed(
      charge,
      dispute.status,
      dispute.id,
    );
  }

  return handleEventChargeDispute(charge, dispute.status, dispute.id);
}

export async function POST(request) {
  if (!isStripeWebhookConfigured()) {
    return Response.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  const payload = await request.text();
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    // Stripe signature errors carry the raw payload and signature header. Log
    // only a non-sensitive classification, never the full error object.
    console.error(
      `[stripe] webhook signature verification failed (${errorKind(error)}).`,
    );
    return Response.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    const result = await processStripeWebhookOnce(event, async (stripeEvent) => {
      const object = stripeEvent.data.object;

      switch (stripeEvent.type) {
        case "checkout.session.completed":
          if (object.metadata?.scope === "event_post") {
            if (object.payment_status === "paid") {
              await syncEventPaymentFromCheckoutSession(object.id);
            } else {
              await handleEventCheckoutSessionProcessing(object);
            }
          } else if (object.metadata?.scope === "account") {
            await syncSubscriptionFromCheckoutSessionId(object.id);
          }
          break;

        case "checkout.session.async_payment_succeeded":
          if (object.metadata?.scope === "event_post") {
            await syncEventPaymentFromCheckoutSession(object.id);
          } else if (object.metadata?.scope === "account") {
            await syncSubscriptionFromCheckoutSessionId(object.id);
          }
          break;

        case "checkout.session.async_payment_failed":
          if (object.metadata?.scope === "event_post") {
            await handleEventCheckoutSessionFailure(object, "failed");
          } else if (object.metadata?.scope === "account") {
            await releaseAccountCheckoutFence(object);
          }
          break;

        case "checkout.session.expired":
          if (object.metadata?.scope === "event_post") {
            await handleEventCheckoutSessionFailure(object, "expired");
          } else if (object.metadata?.scope === "account") {
            await releaseAccountCheckoutFence(object);
          }
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleStripeSubscriptionWebhook(object, stripeEvent.id);
          break;

        case "charge.refunded":
          await handleEventChargeRefunded(object);
          break;

        case "charge.dispute.created":
        case "charge.dispute.updated":
        case "charge.dispute.closed": {
          await syncEventDispute(object.id);
          break;
        }

        case "refund.created":
        case "refund.updated":
        case "refund.failed":
          await handleEventRefundUpdated(object);
          break;

        default:
          break;
      }
    });

    if (result.inProgress) {
      return Response.json(
        { received: false, retry: true },
        { status: 409, headers: { "Retry-After": "5" } },
      );
    }

    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error(`[stripe] webhook handling failed (${errorKind(error)}).`);
    return Response.json(
      { error: "Stripe webhook handling failed." },
      { status: 500 },
    );
  }

}
