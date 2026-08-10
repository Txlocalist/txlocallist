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
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  }

  return (configuredUrl || "http://localhost:3000").replace(/\/$/, "");
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
