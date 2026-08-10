import "dotenv/config";

import Stripe from "stripe";

const EVENT_CATALOG_KEY = "tx_localist_event_post";
const MEMBERSHIP_CATALOG_KEY = "tx_localist_membership_monthly";
const PRICE_CENTS = 1000;

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

if (secretKey.startsWith("sk_live_") && !process.argv.includes("--allow-live")) {
  throw new Error("Refusing to change the live Stripe catalog without --allow-live.");
}

const stripe = new Stripe(secretKey, {
  appInfo: { name: "tx-localist-catalog-setup" },
});

async function findPrice(productId, { recurring, catalogKey }) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return prices.data.find((price) =>
    price.unit_amount === PRICE_CENTS &&
    price.currency === "usd" &&
    Boolean(price.recurring) === recurring &&
    price.metadata?.catalogKey === catalogKey
  );
}

async function getMembershipProductId() {
  const configuredPriceId = process.env.STRIPE_PRICE_STARTER?.trim();
  if (!configuredPriceId) {
    throw new Error("STRIPE_PRICE_STARTER must identify the existing membership product.");
  }

  const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
  return typeof configuredPrice.product === "string"
    ? configuredPrice.product
    : configuredPrice.product.id;
}

async function ensureMembershipPrice() {
  const productId = await getMembershipProductId();
  const existing = await findPrice(productId, {
    recurring: true,
    catalogKey: MEMBERSHIP_CATALOG_KEY,
  });
  if (existing) return existing;

  await stripe.products.update(productId, {
    name: "TX Localist Local Business Membership",
    metadata: { catalogKey: "tx_localist_membership" },
  });

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: PRICE_CENTS,
    recurring: { interval: "month" },
    metadata: { catalogKey: MEMBERSHIP_CATALOG_KEY },
  });
}

async function ensureEventProduct() {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find(
    (product) => product.metadata?.catalogKey === EVENT_CATALOG_KEY,
  );
  if (existing) return existing;

  return stripe.products.create({
    name: "TX Localist Event Calendar Post",
    description: "One calendar post for one continuous event lasting up to 31 days.",
    metadata: { catalogKey: EVENT_CATALOG_KEY },
  });
}

async function ensureEventPrice() {
  const product = await ensureEventProduct();
  const existing = await findPrice(product.id, {
    recurring: false,
    catalogKey: EVENT_CATALOG_KEY,
  });
  if (existing) return existing;

  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: PRICE_CENTS,
    metadata: { catalogKey: EVENT_CATALOG_KEY },
  });
}

const [membershipPrice, eventPrice] = await Promise.all([
  ensureMembershipPrice(),
  ensureEventPrice(),
]);

console.log(`STRIPE_PRICE_STARTER=${membershipPrice.id}`);
console.log(`STRIPE_PRICE_EVENT_POST=${eventPrice.id}`);
console.log(`STRIPE_MODE=${membershipPrice.livemode ? "live" : "test"}`);

