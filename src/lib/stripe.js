import Stripe from "stripe";

const globalForStripe = globalThis;

function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  return key;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  return configuredUrl.replace(/\/$/, "");
}

export function getStripe() {
  if (!globalForStripe.__txStripeClient) {
    globalForStripe.__txStripeClient = new Stripe(getStripeSecretKey(), {
      appInfo: {
        name: "tx-localist",
      },
    });
  }

  return globalForStripe.__txStripeClient;
}
