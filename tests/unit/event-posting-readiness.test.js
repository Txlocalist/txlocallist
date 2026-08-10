import { describe, expect, it, vi } from "vitest";

import {
  formatReadinessReport,
  REQUIRED_EVENT_POSTING_MIGRATIONS,
  REQUIRED_STRIPE_WEBHOOK_EVENTS,
  verifyEventPostingReadiness,
} from "../../scripts/verify-event-posting-readiness.mjs";

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://txlocalist.example",
    DATABASE_URL: "postgresql://readonly:secret@db.example/txlocalist",
    STRIPE_SECRET_KEY: "sk_live_readonly",
    NEXT_PUBLIC_STRIPE_PK: "pk_live_browser",
    STRIPE_PRICE_STARTER: "price_starter_live",
    STRIPE_PRICE_EVENT_POST: "price_event_live",
    STRIPE_WEBHOOK_SECRET: "whsec_production",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_production",
    CRON_SECRET: "production-cron-secret",
    EVENT_POSTING_ENABLED: "false",
    ...overrides,
  };
}

function deploymentConfig() {
  return {
    crons: [{
      path: "/api/event-images/cleanup",
      schedule: "0 8 * * *",
    }],
  };
}

function livePrice(overrides = {}) {
  return {
    id: "price_starter_live",
    active: true,
    livemode: true,
    unit_amount: 1000,
    currency: "usd",
    recurring: { interval: "month", interval_count: 1 },
    product: "prod_starter",
    metadata: { catalogKey: "tx_localist_membership_monthly" },
    ...overrides,
  };
}

function liveProduct(id, catalogKey) {
  return {
    id,
    active: true,
    livemode: true,
    metadata: { catalogKey },
  };
}

function stripeFake(overrides = {}) {
  const prices = {
    price_starter_live: livePrice(),
    price_event_live: livePrice({
      id: "price_event_live",
      recurring: null,
      product: "prod_event",
      metadata: { catalogKey: "tx_localist_event_post" },
    }),
    ...overrides.prices,
  };
  const products = {
    prod_starter: liveProduct("prod_starter", "tx_localist_membership"),
    prod_event: liveProduct("prod_event", "tx_localist_event_post"),
    ...overrides.products,
  };

  return {
    prices: {
      retrieve: vi.fn(async (priceId) => prices[priceId] ?? null),
    },
    products: {
      retrieve: vi.fn(async (productId) => products[productId] ?? null),
    },
    webhookEndpoints: overrides.webhookEndpoints ?? {
      list: vi.fn(async () => ({
        data: [{
          id: "we_live",
          url: "https://txlocalist.example/api/stripe/webhook",
          status: "enabled",
          livemode: true,
          enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
        }],
      })),
    },
  };
}

function appliedMigrations() {
  return REQUIRED_EVENT_POSTING_MIGRATIONS.map((migrationName) => ({
    migrationName,
    finishedAt: new Date("2026-08-10T18:00:00.000Z"),
    rolledBackAt: null,
  }));
}

function prismaFake(overrides = {}) {
  const migrationRows = overrides.migrationRows ?? appliedMigrations();
  const indexRows = overrides.indexRows ?? [{
    indexName: "EventPayment_one_active_checkout_per_event",
    indexDefinition:
      'CREATE UNIQUE INDEX "EventPayment_one_active_checkout_per_event" ' +
      'ON public."EventPayment" USING btree ("eventId") ' +
      "WHERE (status = ANY (ARRAY['CREATED', 'PROCESSING']))",
  }];

  return {
    plan: {
      findUnique: vi.fn(async () => overrides.starterPlan ?? {
        name: "Local Business Membership",
        tier: 1,
        priceCents: 1000,
        billingPeriod: "monthly",
        stripePriceId: "price_starter_live",
      }),
    },
    eventPayment: {
      groupBy: vi.fn(async () => overrides.duplicateGroups ?? []),
    },
    $queryRawUnsafe: vi.fn(async (query) =>
      query.includes("_prisma_migrations") ? migrationRows : indexRows),
  };
}

function check(report, id) {
  return report.checks.find((candidate) => candidate.id === id);
}

describe("one-time event posting production readiness verifier", () => {
  it("passes every automated read-only check but preserves the manual launch gate", async () => {
    const stripe = stripeFake();
    const prisma = prismaFake();

    const report = await verifyEventPostingReadiness({
      env: productionEnv(),
      stripe,
      prisma,
      deploymentConfig: deploymentConfig(),
    });

    expect(report.automatedChecksPassed).toBe(true);
    expect(report.readyToEnable).toBe(false);
    expect(report.checks.filter(({ status }) => status === "fail")).toEqual([]);
    expect(check(report, "manual.tax_adviser")).toMatchObject({
      status: "manual",
    });
    expect(stripe.prices.retrieve).toHaveBeenCalledTimes(2);
    expect(stripe.products.retrieve).toHaveBeenCalledTimes(2);
    expect(stripe.webhookEndpoints.list).toHaveBeenCalledWith({ limit: 100 });
    expect(prisma.plan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "starter" } }),
    );
    expect(prisma.eventPayment.groupBy).toHaveBeenCalledWith({
      by: ["eventId"],
      where: { status: { in: ["CREATED", "PROCESSING"] } },
      _count: { eventId: true },
      having: { eventId: { _count: { gt: 1 } } },
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(formatReadinessReport(report)).toContain("NOT AUTHORIZED TO ENABLE");
  });

  it("fails closed on unsafe environment mode without querying Stripe or the database", async () => {
    const stripe = stripeFake();
    const prisma = prismaFake();

    const report = await verifyEventPostingReadiness({
      env: productionEnv({
        STRIPE_SECRET_KEY: "sk_test_not_production",
        EVENT_POSTING_ENABLED: "true",
      }),
      stripe,
      prisma,
      deploymentConfig: deploymentConfig(),
    });

    expect(report.automatedChecksPassed).toBe(false);
    expect(check(report, "env.stripe_secret_mode").status).toBe("fail");
    expect(check(report, "env.feature_gate").status).toBe("fail");
    expect(stripe.prices.retrieve).not.toHaveBeenCalled();
    expect(stripe.webhookEndpoints.list).not.toHaveBeenCalled();
    expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects invalid catalog objects and incomplete webhook coverage", async () => {
    const stripe = stripeFake({
      prices: {
        price_starter_live: livePrice({
          unit_amount: 1200,
          product: "prod_shared",
        }),
        price_event_live: livePrice({
          id: "price_event_live",
          recurring: { interval: "month", interval_count: 1 },
          product: "prod_shared",
        }),
      },
      products: {
        prod_shared: liveProduct("prod_shared", "tx_localist_membership"),
      },
      webhookEndpoints: {
        list: vi.fn(async () => ({
          data: [{
            id: "we_live",
            url: "https://txlocalist.example/api/stripe/webhook",
            status: "disabled",
            livemode: true,
            enabled_events: ["checkout.session.completed"],
          }],
        })),
      },
    });

    const report = await verifyEventPostingReadiness({
      env: productionEnv(),
      stripe,
      prisma: prismaFake(),
      deploymentConfig: deploymentConfig(),
    });

    expect(report.automatedChecksPassed).toBe(false);
    expect(check(report, "stripe.starter_price")).toMatchObject({ status: "fail" });
    expect(check(report, "stripe.event_price")).toMatchObject({ status: "fail" });
    expect(check(report, "stripe.products")).toMatchObject({ status: "fail" });
    expect(check(report, "stripe.webhook")).toMatchObject({ status: "fail" });
    expect(check(report, "stripe.webhook").message).toContain("missing events");
  });

  it("accepts Stripe wildcard webhook coverage only at the exact enabled live URL", async () => {
    const stripe = stripeFake({
      webhookEndpoints: {
        list: vi.fn(async () => ({
          data: [
            {
              id: "we_wrong_url",
              url: "https://other.example/api/stripe/webhook",
              status: "enabled",
              livemode: true,
              enabled_events: ["*"],
            },
            {
              id: "we_live",
              url: "https://txlocalist.example/api/stripe/webhook",
              status: "enabled",
              livemode: true,
              enabled_events: ["*"],
            },
          ],
        })),
      },
    });

    const report = await verifyEventPostingReadiness({
      env: productionEnv(),
      stripe,
      prisma: prismaFake(),
      deploymentConfig: deploymentConfig(),
    });

    expect(check(report, "stripe.webhook")).toMatchObject({ status: "pass" });
    expect(report.automatedChecksPassed).toBe(true);
  });

  it("reports database drift, duplicate active attempts, and unapplied schema expectations", async () => {
    const prisma = prismaFake({
      starterPlan: {
        name: "Starter",
        tier: 1,
        priceCents: 2500,
        billingPeriod: "monthly",
        stripePriceId: "price_old",
      },
      duplicateGroups: [{
        eventId: "event_duplicate",
        _count: { eventId: 2 },
      }],
      migrationRows: appliedMigrations().slice(0, -1),
      indexRows: [],
    });

    const report = await verifyEventPostingReadiness({
      env: productionEnv(),
      stripe: stripeFake(),
      prisma,
      deploymentConfig: deploymentConfig(),
    });

    expect(report.automatedChecksPassed).toBe(false);
    expect(check(report, "db.starter_plan")).toMatchObject({ status: "fail" });
    expect(check(report, "db.active_checkout_duplicates")).toMatchObject({
      status: "fail",
    });
    expect(check(report, "db.migrations")).toMatchObject({ status: "fail" });
    expect(check(report, "db.migrations").message).toContain(
      "20260810004000_track_event_refund_status",
    );
    expect(check(report, "db.active_checkout_index")).toMatchObject({
      status: "fail",
    });
  });
});
