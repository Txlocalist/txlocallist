import "./load-next-environment.mjs";

import Stripe from "stripe";

import {
  getRuntimeEnvironment,
  validateRuntimeConfiguration,
} from "../src/lib/runtime-config.mjs";
import { MAX_EVENT_CALENDAR_DAYS } from "../src/lib/event-dates.js";

const EVENT_CATALOG_KEY = "tx_localist_event_post";
const MEMBERSHIP_CATALOG_KEY = "tx_localist_membership_monthly";
const PRICE_CENTS = 1000;
const EVENT_TAX_CODE = "txcd_10701000";
const EVENT_PRODUCT_NAME = "TX Localist Event Calendar Post";
const EVENT_PRODUCT_DESCRIPTION =
  `One calendar post for one continuous event lasting up to ${MAX_EVENT_CALENDAR_DAYS} days.`;

const environment = getRuntimeEnvironment(process.env);
const runtimeConfiguration = validateRuntimeConfiguration(process.env, {
  environment,
});

if (!runtimeConfiguration.ok) {
  const details = runtimeConfiguration.issues
    .map((issue) => `${issue.code}: ${issue.message}`)
    .join("\n");
  throw new Error(`Refusing to modify the Stripe catalog:\n${details}`);
}

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
    (
      !recurring ||
      (
        price.recurring?.interval === "month" &&
        (price.recurring.interval_count ?? 1) === 1
      )
    ) &&
    (recurring || price.tax_behavior === "exclusive") &&
    price.metadata?.catalogKey === catalogKey
  );
}

async function getConfiguredMembershipPrice() {
  const configuredPriceId = process.env.STRIPE_PRICE_STARTER?.trim();
  if (!configuredPriceId) {
    throw new Error("STRIPE_PRICE_STARTER must identify the existing membership product.");
  }

  return stripe.prices.retrieve(configuredPriceId);
}

async function ensureMembershipPrice(configuredPrice) {
  const productId = typeof configuredPrice.product === "string"
    ? configuredPrice.product
    : configuredPrice.product.id;
  const existingCatalogPrice = await findPrice(productId, {
    recurring: true,
    catalogKey: MEMBERSHIP_CATALOG_KEY,
  });

  await stripe.products.update(productId, {
    metadata: { catalogKey: "tx_localist_membership" },
  });

  const configuredPriceIsCompatible = Boolean(
    configuredPrice.active &&
    configuredPrice.unit_amount === PRICE_CENTS &&
    configuredPrice.currency === "usd" &&
    configuredPrice.recurring?.interval === "month" &&
    (configuredPrice.recurring.interval_count ?? 1) === 1
  );
  const membershipPrice = existingCatalogPrice ??
    (configuredPriceIsCompatible ? configuredPrice : null);
  if (membershipPrice) {
    if (membershipPrice.metadata?.catalogKey !== MEMBERSHIP_CATALOG_KEY) {
      return stripe.prices.update(membershipPrice.id, {
        metadata: { catalogKey: MEMBERSHIP_CATALOG_KEY },
      });
    }
    return membershipPrice;
  }

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
  if (existing) {
    if (
      existing.name !== EVENT_PRODUCT_NAME ||
      existing.description !== EVENT_PRODUCT_DESCRIPTION ||
      existing.tax_code !== EVENT_TAX_CODE
    ) {
      return stripe.products.update(existing.id, {
        name: EVENT_PRODUCT_NAME,
        description: EVENT_PRODUCT_DESCRIPTION,
        tax_code: EVENT_TAX_CODE,
        metadata: { catalogKey: EVENT_CATALOG_KEY },
      });
    }
    return existing;
  }

  return stripe.products.create({
    name: EVENT_PRODUCT_NAME,
    description: EVENT_PRODUCT_DESCRIPTION,
    tax_code: EVENT_TAX_CODE,
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
    tax_behavior: "exclusive",
    metadata: { catalogKey: EVENT_CATALOG_KEY },
  });
}

// Resolve every required input before the first catalog write. In particular,
// a missing membership Price must not race with creation of the event Product.
const configuredMembershipPrice = await getConfiguredMembershipPrice();
const membershipPrice = await ensureMembershipPrice(configuredMembershipPrice);
const eventPrice = await ensureEventPrice();

console.log(`STRIPE_PRICE_STARTER=${membershipPrice.id}`);
console.log(`STRIPE_PRICE_EVENT_POST=${eventPrice.id}`);
console.log(`STRIPE_MODE=${membershipPrice.livemode ? "live" : "test"}`);

