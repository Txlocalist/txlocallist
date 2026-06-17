import {
  handleStripeSubscriptionWebhook,
  syncSubscriptionFromCheckoutSessionId,
} from "@/lib/billing";
import { getStripe, isStripeWebhookConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

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
    console.error("[stripe] webhook signature verification failed:", error);
    return Response.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncSubscriptionFromCheckoutSessionId(event.data.object.id);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleStripeSubscriptionWebhook(event.data.object);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("[stripe] webhook handling failed:", error);
    return Response.json(
      { error: "Stripe webhook handling failed." },
      { status: 500 },
    );
  }

  return Response.json({ received: true });
}
