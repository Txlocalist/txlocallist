import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_AMOUNT_CENTS = 1000;
const EXPECTED_CURRENCY = "usd";
const ACTIVE_PAYMENT_STATUSES = Object.freeze(["CREATED", "PROCESSING"]);
const STARTER_CATALOG_KEY = "tx_localist_membership";
const STARTER_PRICE_CATALOG_KEY = "tx_localist_membership_monthly";
const EVENT_CATALOG_KEY = "tx_localist_event_post";

export const REQUIRED_EVENT_POSTING_MIGRATIONS = Object.freeze([
  "20260807000000_baseline",
  "20260807000100_add_event_payments",
  "20260807000200_event_payment_customer",
  "20260807000300_harden_event_refunds",
  "20260807000400_track_event_disputes",
  "20260807000500_add_event_cancellation_reason",
  "20260810001000_one_active_event_checkout",
  "20260810002000_sync_starter_membership_plan",
  "20260810003000_event_image_upload_lifecycle",
  "20260810004000_track_event_refund_status",
]);

export const REQUIRED_STRIPE_WEBHOOK_EVENTS = Object.freeze([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "refund.created",
  "refund.updated",
  "refund.failed",
]);

const MIGRATION_STATE_QUERY = `
SELECT
  "migration_name" AS "migrationName",
  "finished_at" AS "finishedAt",
  "rolled_back_at" AS "rolledBackAt"
FROM "_prisma_migrations"
ORDER BY "started_at" ASC
`;

const ACTIVE_CHECKOUT_INDEX_QUERY = `
SELECT
  "indexname" AS "indexName",
  "indexdef" AS "indexDefinition"
FROM "pg_indexes"
WHERE "schemaname" = current_schema()
  AND "tablename" = 'EventPayment'
  AND "indexname" = 'EventPayment_one_active_checkout_per_event'
`;

function result(id, status, message) {
  return { id, status, message };
}

function pass(id, message) {
  return result(id, "pass", message);
}

function fail(id, message) {
  return result(id, "fail", message);
}

function manual(id, message) {
  return result(id, "manual", message);
}

function value(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

function parseProductionSiteUrl(rawUrl) {
  try {
    const siteUrl = new URL(rawUrl);
    if (
      siteUrl.protocol !== "https:" ||
      isLocalHostname(siteUrl.hostname) ||
      siteUrl.username ||
      siteUrl.password ||
      siteUrl.search ||
      siteUrl.hash ||
      !["", "/"].includes(siteUrl.pathname)
    ) {
      return null;
    }
    return siteUrl;
  } catch {
    return null;
  }
}

function objectId(candidate) {
  if (!candidate) return null;
  return typeof candidate === "string" ? candidate : candidate.id;
}

function safeReadFailure(service, error) {
  const code = value(error?.code) || value(error?.type);
  return `${service} could not be read${code ? ` (${code})` : ""}; verify credentials and read permissions.`;
}

function priceProblems(price, { recurring, catalogKey }) {
  const problems = [];
  if (!price || price.deleted) return ["the configured Price does not exist"];
  if (price.active !== true) problems.push("Price is not active");
  if (price.livemode !== true) problems.push("Price is not in live mode");
  if (price.unit_amount !== EXPECTED_AMOUNT_CENTS) {
    problems.push("unit amount is not USD 1000");
  }
  if (price.currency !== EXPECTED_CURRENCY) problems.push("currency is not usd");
  if (!objectId(price.product)) problems.push("Price has no product");
  if (price.metadata?.catalogKey !== catalogKey) {
    problems.push(`Price catalogKey is not ${catalogKey}`);
  }

  if (recurring) {
    if (
      price.recurring?.interval !== "month" ||
      (price.recurring.interval_count ?? 1) !== 1
    ) {
      problems.push("Price is not recurring once per month");
    }
  } else if (price.recurring) {
    problems.push("Price is recurring instead of one-time");
  }

  return problems;
}

function productProblems(product, catalogKey) {
  const problems = [];
  if (!product || product.deleted) return ["the Price product does not exist"];
  if (product.active !== true) problems.push("product is not active");
  if (product.livemode !== true) problems.push("product is not in live mode");
  if (product.metadata?.catalogKey !== catalogKey) {
    problems.push(`product catalogKey is not ${catalogKey}`);
  }
  return problems;
}

function normalizeEndpointUrl(endpointUrl) {
  return endpointUrl.endsWith("/") ? endpointUrl.slice(0, -1) : endpointUrl;
}

function isOnceDailyCron(schedule) {
  const fields = value(schedule).split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  return (
    /^\d{1,2}$/.test(minute) &&
    /^\d{1,2}$/.test(hour) &&
    minuteNumber >= 0 &&
    minuteNumber <= 59 &&
    hourNumber >= 0 &&
    hourNumber <= 23 &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  );
}

function verifyDeploymentManifest(deploymentConfig) {
  const cleanupCron = deploymentConfig?.crons?.find(
    (cron) => cron.path === "/api/event-images/cleanup",
  );
  return cleanupCron && isOnceDailyCron(cleanupCron.schedule)
    ? pass(
      "deployment.image_cleanup_cron",
      "The deployment manifest schedules event-image cleanup once per day.",
    )
    : fail(
      "deployment.image_cleanup_cron",
      "vercel.json must schedule /api/event-images/cleanup exactly once per day.",
    );
}

export function validateProductionEnvironment(env) {
  const checks = [];
  const nodeEnv = value(env.NODE_ENV);
  checks.push(
    nodeEnv === "production"
      ? pass("env.node_mode", "NODE_ENV is production.")
      : fail("env.node_mode", "NODE_ENV must be exactly production."),
  );

  const rawSiteUrl = value(env.NEXT_PUBLIC_SITE_URL);
  const siteUrl = parseProductionSiteUrl(rawSiteUrl);
  checks.push(
    siteUrl
      ? pass("env.site_url", "NEXT_PUBLIC_SITE_URL is an HTTPS production origin.")
      : fail(
        "env.site_url",
        "NEXT_PUBLIC_SITE_URL must be an HTTPS, non-local origin with no path, query, or credentials.",
      ),
  );

  const databaseUrl = value(env.DATABASE_URL);
  checks.push(
    /^(postgres|postgresql):\/\//.test(databaseUrl)
      ? pass("env.database_url", "DATABASE_URL is present and uses PostgreSQL.")
      : fail("env.database_url", "DATABASE_URL must be a PostgreSQL connection URL."),
  );

  const secretKey = value(env.STRIPE_SECRET_KEY);
  checks.push(
    secretKey.startsWith("sk_live_")
      ? pass("env.stripe_secret_mode", "STRIPE_SECRET_KEY is in live mode.")
      : fail("env.stripe_secret_mode", "STRIPE_SECRET_KEY must be an sk_live_ key."),
  );

  const publicKey = value(env.NEXT_PUBLIC_STRIPE_PK);
  checks.push(
    publicKey.startsWith("pk_live_")
      ? pass("env.stripe_public_mode", "NEXT_PUBLIC_STRIPE_PK is in live mode.")
      : fail("env.stripe_public_mode", "NEXT_PUBLIC_STRIPE_PK must be a pk_live_ key."),
  );

  const starterPriceId = value(env.STRIPE_PRICE_STARTER);
  checks.push(
    starterPriceId.startsWith("price_")
      ? pass("env.starter_price", "STRIPE_PRICE_STARTER is configured.")
      : fail("env.starter_price", "STRIPE_PRICE_STARTER must be a Stripe Price ID."),
  );

  const eventPriceId = value(env.STRIPE_PRICE_EVENT_POST);
  checks.push(
    eventPriceId.startsWith("price_")
      ? pass("env.event_price", "STRIPE_PRICE_EVENT_POST is configured.")
      : fail("env.event_price", "STRIPE_PRICE_EVENT_POST must be a Stripe Price ID."),
  );
  if (
    starterPriceId.startsWith("price_") &&
    eventPriceId.startsWith("price_") &&
    starterPriceId === eventPriceId
  ) {
    checks.push(
      fail(
        "env.distinct_prices",
        "Starter and event posting must use distinct Stripe Prices.",
      ),
    );
  } else {
    checks.push(
      pass("env.distinct_prices", "Starter and event posting use distinct Price IDs."),
    );
  }

  checks.push(
    value(env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_")
      ? pass("env.webhook_secret", "STRIPE_WEBHOOK_SECRET is configured.")
      : fail("env.webhook_secret", "STRIPE_WEBHOOK_SECRET must be a whsec_ secret."),
  );

  checks.push(
    value(env.BLOB_READ_WRITE_TOKEN)
      ? pass("env.blob_token", "BLOB_READ_WRITE_TOKEN is configured.")
      : fail(
        "env.blob_token",
        "BLOB_READ_WRITE_TOKEN is required for event image upload and cleanup.",
      ),
  );

  checks.push(
    value(env.CRON_SECRET).length >= 16
      ? pass("env.cron_secret", "CRON_SECRET is configured with at least 16 characters.")
      : fail(
        "env.cron_secret",
        "CRON_SECRET must be configured with at least 16 characters.",
      ),
  );

  const eventPostingEnabled = value(env.EVENT_POSTING_ENABLED);
  checks.push(
    eventPostingEnabled === "false"
      ? pass(
        "env.feature_gate",
        "EVENT_POSTING_ENABLED is false for the production preflight.",
      )
      : fail(
        "env.feature_gate",
        "EVENT_POSTING_ENABLED must remain exactly false during this preflight.",
      ),
  );

  return {
    checks,
    siteUrl,
    starterPriceId,
    eventPriceId,
  };
}

async function verifyStripeCatalog(stripe, environment) {
  const checks = [];
  let starterPrice;
  let eventPrice;

  try {
    [starterPrice, eventPrice] = await Promise.all([
      stripe.prices.retrieve(environment.starterPriceId),
      stripe.prices.retrieve(environment.eventPriceId),
    ]);
  } catch (error) {
    checks.push(fail("stripe.catalog_read", safeReadFailure("Stripe Prices", error)));
    return checks;
  }

  const starterProblems = priceProblems(starterPrice, {
    recurring: true,
    catalogKey: STARTER_PRICE_CATALOG_KEY,
  });
  checks.push(
    starterProblems.length === 0
      ? pass("stripe.starter_price", "Starter is active, live, USD 1000 monthly.")
      : fail("stripe.starter_price", `Starter Price invalid: ${starterProblems.join("; ")}.`),
  );

  const eventProblems = priceProblems(eventPrice, {
    recurring: false,
    catalogKey: EVENT_CATALOG_KEY,
  });
  checks.push(
    eventProblems.length === 0
      ? pass("stripe.event_price", "Event posting is active, live, and USD 1000 one-time.")
      : fail("stripe.event_price", `Event Price invalid: ${eventProblems.join("; ")}.`),
  );

  const starterProductId = objectId(starterPrice?.product);
  const eventProductId = objectId(eventPrice?.product);
  if (!starterProductId || !eventProductId) {
    checks.push(
      fail("stripe.products", "Both configured Prices must reference retrievable products."),
    );
    return checks;
  }

  let starterProduct;
  let eventProduct;
  try {
    [starterProduct, eventProduct] = await Promise.all([
      typeof starterPrice.product === "object"
        ? starterPrice.product
        : stripe.products.retrieve(starterProductId),
      typeof eventPrice.product === "object"
        ? eventPrice.product
        : stripe.products.retrieve(eventProductId),
    ]);
  } catch (error) {
    checks.push(fail("stripe.products", safeReadFailure("Stripe Products", error)));
    return checks;
  }

  const starterProductProblems = productProblems(
    starterProduct,
    STARTER_CATALOG_KEY,
  );
  const eventProductProblems = productProblems(eventProduct, EVENT_CATALOG_KEY);
  if (starterProductId === eventProductId) {
    starterProductProblems.push("Starter and event posting share one product");
  }

  const allProductProblems = [
    ...starterProductProblems.map((problem) => `Starter ${problem}`),
    ...eventProductProblems.map((problem) => `Event ${problem}`),
  ];
  checks.push(
    allProductProblems.length === 0
      ? pass("stripe.products", "Both Prices use distinct, active, live products.")
      : fail("stripe.products", `Stripe Products invalid: ${allProductProblems.join("; ")}.`),
  );

  return checks;
}

async function verifyStripeWebhook(stripe, siteUrl) {
  if (typeof stripe.webhookEndpoints?.list !== "function") {
    return fail(
      "stripe.webhook",
      "This Stripe client cannot list webhook endpoints; readiness cannot be established automatically.",
    );
  }

  let endpointPage;
  try {
    endpointPage = await stripe.webhookEndpoints.list({ limit: 100 });
  } catch (error) {
    return fail("stripe.webhook", safeReadFailure("Stripe webhook endpoints", error));
  }

  const expectedUrl = new URL("/api/stripe/webhook", siteUrl).href;
  const endpoint = (endpointPage?.data ?? []).find(
    (candidate) =>
      normalizeEndpointUrl(candidate.url ?? "") === normalizeEndpointUrl(expectedUrl),
  );
  if (!endpoint) {
    return fail(
      "stripe.webhook",
      `No Stripe webhook endpoint exactly matches ${expectedUrl}.`,
    );
  }

  const enabledEvents = endpoint.enabled_events ?? [];
  const missingEvents = enabledEvents.includes("*")
    ? []
    : REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
      (eventType) => !enabledEvents.includes(eventType),
    );
  const problems = [];
  if (endpoint.status !== "enabled") problems.push("endpoint status is not enabled");
  if (endpoint.livemode !== true) problems.push("endpoint is not in live mode");
  if (missingEvents.length > 0) {
    problems.push(`missing events: ${missingEvents.join(", ")}`);
  }

  return problems.length === 0
    ? pass(
      "stripe.webhook",
      "The exact live webhook endpoint is enabled and covers every required event.",
    )
    : fail("stripe.webhook", `Stripe webhook invalid: ${problems.join("; ")}.`);
}

async function verifyDatabase(prisma, environment) {
  const checks = [];

  try {
    const starterPlan = await prisma.plan.findUnique({
      where: { slug: "starter" },
      select: {
        name: true,
        tier: true,
        priceCents: true,
        billingPeriod: true,
        stripePriceId: true,
      },
    });
    const starterIsValid = Boolean(
      starterPlan &&
      starterPlan.tier === 1 &&
      starterPlan.priceCents === EXPECTED_AMOUNT_CENTS &&
      starterPlan.billingPeriod === "monthly" &&
      starterPlan.stripePriceId === environment.starterPriceId
    );
    checks.push(
      starterIsValid
        ? pass("db.starter_plan", "The Starter Plan row matches the live $10 monthly Price.")
        : fail(
          "db.starter_plan",
          "The Starter Plan row must be tier 1, USD 1000 monthly, and reference STRIPE_PRICE_STARTER.",
        ),
    );
  } catch (error) {
    checks.push(fail("db.starter_plan", safeReadFailure("Starter Plan", error)));
  }

  try {
    const duplicates = await prisma.eventPayment.groupBy({
      by: ["eventId"],
      where: { status: { in: ACTIVE_PAYMENT_STATUSES } },
      _count: { eventId: true },
      having: { eventId: { _count: { gt: 1 } } },
    });
    checks.push(
      duplicates.length === 0
        ? pass("db.active_checkout_duplicates", "No event has duplicate active payments.")
        : fail(
          "db.active_checkout_duplicates",
          `${duplicates.length} event(s) have multiple CREATED/PROCESSING payments; reconcile them before migration or launch.`,
        ),
    );
  } catch (error) {
    checks.push(
      fail(
        "db.active_checkout_duplicates",
        safeReadFailure("Active EventPayment groups", error),
      ),
    );
  }

  try {
    const migrationRows = await prisma.$queryRawUnsafe(MIGRATION_STATE_QUERY);
    const migrationByName = new Map(
      migrationRows.map((migration) => [migration.migrationName, migration]),
    );
    const missing = REQUIRED_EVENT_POSTING_MIGRATIONS.filter(
      (migrationName) => !migrationByName.has(migrationName),
    );
    const incomplete = migrationRows.filter(
      (migration) => !migration.finishedAt && !migration.rolledBackAt,
    );
    const requiredRolledBack = REQUIRED_EVENT_POSTING_MIGRATIONS.filter(
      (migrationName) => migrationByName.get(migrationName)?.rolledBackAt,
    );
    const problems = [];
    if (missing.length > 0) problems.push(`missing: ${missing.join(", ")}`);
    if (requiredRolledBack.length > 0) {
      problems.push(`rolled back: ${requiredRolledBack.join(", ")}`);
    }
    if (incomplete.length > 0) {
      problems.push(
        `unfinished: ${incomplete.map((migration) => migration.migrationName).join(", ")}`,
      );
    }
    checks.push(
      problems.length === 0
        ? pass("db.migrations", "Required event-posting migrations are applied.")
        : fail("db.migrations", `Prisma migration state invalid: ${problems.join("; ")}.`),
    );
  } catch (error) {
    checks.push(fail("db.migrations", safeReadFailure("Prisma migration history", error)));
  }

  try {
    const indexRows = await prisma.$queryRawUnsafe(ACTIVE_CHECKOUT_INDEX_QUERY);
    const definition = value(indexRows[0]?.indexDefinition);
    const indexIsValid = Boolean(
      indexRows[0]?.indexName === "EventPayment_one_active_checkout_per_event" &&
      /CREATE\s+UNIQUE\s+INDEX/i.test(definition) &&
      definition.includes("eventId") &&
      definition.includes("CREATED") &&
      definition.includes("PROCESSING")
    );
    checks.push(
      indexIsValid
        ? pass(
          "db.active_checkout_index",
          "The partial unique index for active event Checkout attempts is installed.",
        )
        : fail(
          "db.active_checkout_index",
          "EventPayment_one_active_checkout_per_event is missing or has the wrong predicate.",
        ),
    );
  } catch (error) {
    checks.push(
      fail(
        "db.active_checkout_index",
        safeReadFailure("EventPayment active-attempt index", error),
      ),
    );
  }

  return checks;
}

export async function verifyEventPostingReadiness({
  env,
  stripe,
  prisma,
  deploymentConfig,
}) {
  const environment = validateProductionEnvironment(env);
  const checks = [...environment.checks];

  if (checks.some((check) => check.status === "fail")) {
    checks.push(
      manual(
        "manual.tax_adviser",
        "Tax-adviser approval must be documented before enabling event posting.",
      ),
    );
    return {
      automatedChecksPassed: false,
      readyToEnable: false,
      checks,
    };
  }

  checks.push(verifyDeploymentManifest(deploymentConfig));

  if (!stripe) {
    checks.push(fail("stripe.client", "A Stripe client is required for read-only checks."));
  } else {
    checks.push(...await verifyStripeCatalog(stripe, environment));
    checks.push(await verifyStripeWebhook(stripe, environment.siteUrl));
  }

  if (!prisma) {
    checks.push(fail("db.client", "A Prisma client is required for read-only checks."));
  } else {
    checks.push(...await verifyDatabase(prisma, environment));
  }

  checks.push(
    manual(
      "manual.tax_adviser",
      "Tax-adviser approval must be documented before enabling event posting.",
    ),
  );

  return {
    automatedChecksPassed: !checks.some((check) => check.status === "fail"),
    readyToEnable: false,
    checks,
  };
}

export function formatReadinessReport(report) {
  const labels = { pass: "PASS", fail: "FAIL", manual: "MANUAL" };
  const lines = report.checks.map(
    (check) => `[${labels[check.status]}] ${check.id}: ${check.message}`,
  );
  lines.push("");
  if (report.automatedChecksPassed) {
    lines.push("Automated preflight passed.");
    lines.push(
      "NOT AUTHORIZED TO ENABLE: complete the manual tax-adviser and acceptance-test gates in the launch runbook.",
    );
  } else {
    lines.push("Automated preflight failed. Keep EVENT_POSTING_ENABLED=false.");
  }
  return lines.join("\n");
}

async function runCli() {
  if (!process.argv.includes("--confirm-live-readonly")) {
    console.error(
      "Refusing to query production services without --confirm-live-readonly. This verifier never writes to Stripe or the database.",
    );
    process.exitCode = 1;
    return;
  }

  await import("dotenv/config");
  const environment = validateProductionEnvironment(process.env);
  if (environment.checks.some((check) => check.status === "fail")) {
    const report = {
      automatedChecksPassed: false,
      readyToEnable: false,
      checks: [
        ...environment.checks,
        manual(
          "manual.tax_adviser",
          "Tax-adviser approval must be documented before enabling event posting.",
        ),
      ],
    };
    console.error(formatReadinessReport(report));
    process.exitCode = 1;
    return;
  }

  const [{ default: Stripe }, { PrismaNeon }, { PrismaClient }] =
    await Promise.all([
      import("stripe"),
      import("@prisma/adapter-neon"),
      import("@prisma/client"),
    ]);
  const stripe = new Stripe(value(process.env.STRIPE_SECRET_KEY), {
    appInfo: { name: "tx-localist-event-readiness" },
  });
  const adapter = new PrismaNeon({
    connectionString: value(process.env.DATABASE_URL),
  });
  const prisma = new PrismaClient({ adapter });
  let deploymentConfig = null;
  try {
    deploymentConfig = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    );
  } catch {
    deploymentConfig = null;
  }

  try {
    const report = await verifyEventPostingReadiness({
      env: process.env,
      stripe,
      prisma,
      deploymentConfig,
    });
    const output = formatReadinessReport(report);
    if (report.automatedChecksPassed) {
      console.log(output);
    } else {
      console.error(output);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(safeReadFailure("Production readiness preflight", error));
    process.exitCode = 1;
  });
}
