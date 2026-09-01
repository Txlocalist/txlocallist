import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertComplimentaryRoleMutationEnabled,
  getRuntimeFeatureFlags,
  isComplimentaryRoleMutationsEnabled,
  isEventPostingEnabled,
  validateRuntimeConfiguration,
} from "@/lib/runtime-config.mjs";

const TEST_DATABASE_ENV = Object.freeze({
  TX_LOCALIST_DATABASE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@test.invalid/txlocalist_test",
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runtime feature flags", () => {
  it("uses safe defaults", () => {
    expect(getRuntimeFeatureFlags({})).toMatchObject({
      eventPostingEnabled: false,
      subscriptionInvoiceEventsEnabled: false,
      pastDueAccessEnabled: false,
      billingMutationFenceEnabled: false,
      complimentaryRoleMutationsEnabled: false,
      eventPaymentReconciliationMode: "off",
      rateLimitMode: "observe",
      legacyBlobProxyEnabled: true,
    });
  });

  it("accepts only explicit supported values", () => {
    const result = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        EVENT_POSTING_ENABLED: "yes",
        EVENT_PAYMENT_RECONCILIATION_MODE: "charge",
      },
      { environment: "test" },
    );

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALID_BOOLEAN_FLAG",
      "INVALID_MODE_FLAG",
    ]);
  });

  it("blocks new Complimentary grants even if reserved flags are turned on", () => {
    expect(() =>
      assertComplimentaryRoleMutationEnabled(
        { fromRole: "USER", toRole: "COMPLIMENTARY" },
        {},
      )
    ).toThrow(/temporarily disabled/i);

    expect(() =>
      assertComplimentaryRoleMutationEnabled(
        { fromRole: "COMPLIMENTARY", toRole: "USER" },
        {},
      )
    ).not.toThrow();

    expect(() =>
      assertComplimentaryRoleMutationEnabled(
        { fromRole: "USER", toRole: "COMPLIMENTARY" },
        {
          BILLING_MUTATION_FENCE_ENABLED: "true",
          COMPLIMENTARY_ROLE_MUTATIONS_ENABLED: "true",
        },
      )
    ).toThrow(/temporarily disabled/i);
    expect(
      isComplimentaryRoleMutationsEnabled({
        BILLING_MUTATION_FENCE_ENABLED: "true",
        COMPLIMENTARY_ROLE_MUTATIONS_ENABLED: "true",
      }),
    ).toBe(false);
  });

  it("enables event posting only in a fully isolated non-production environment", () => {
    const safeEventEnvironment = {
      ...TEST_DATABASE_ENV,
      TX_LOCALIST_ENV: "test",
      EVENT_POSTING_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_test_example",
      NEXT_PUBLIC_STRIPE_PK: "pk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_PRICE_EVENT_POST: "price_event",
    };

    expect(isEventPostingEnabled(safeEventEnvironment)).toBe(true);
    expect(
      isEventPostingEnabled({
        ...safeEventEnvironment,
        STRIPE_SECRET_KEY: "sk_live_example",
      }),
    ).toBe(false);
    expect(
      isEventPostingEnabled({
        ...safeEventEnvironment,
        TX_LOCALIST_DATABASE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isEventPostingEnabled({
        ...safeEventEnvironment,
        TX_LOCALIST_ENV: "production",
        TX_LOCALIST_DATABASE_ENV: "production",
        STRIPE_SECRET_KEY: "sk_live_example",
        NEXT_PUBLIC_STRIPE_PK: "pk_live_example",
      }),
    ).toBe(false);
  });
});

describe("runtime environment safety", () => {
  it("rejects live Stripe keys outside production", () => {
    const result = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        STRIPE_SECRET_KEY: "sk_live_example",
        NEXT_PUBLIC_STRIPE_PK: "pk_live_example",
      },
      { environment: "development" },
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      "LIVE_STRIPE_KEY_OUTSIDE_PRODUCTION",
    );
  });

  it("accepts a complete live production configuration", () => {
    const result = validateRuntimeConfiguration(
      {
        TX_LOCALIST_DATABASE_ENV: "production",
        DATABASE_URL: "postgresql://example.invalid/txlocalist",
        DATABASE_URL_UNPOOLED: "postgresql://example.invalid/txlocalist",
        NEXT_PUBLIC_SITE_URL: "https://txlocalist.example",
        CRON_SECRET: "a-production-cron-secret",
        STRIPE_SECRET_KEY: "sk_live_example",
        NEXT_PUBLIC_STRIPE_PK: "pk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        STRIPE_PRICE_STARTER: "price_starter",
        BLOB_READ_WRITE_TOKEN: "blob-token",
      },
      { environment: "production" },
    );

    expect(result).toMatchObject({
      ok: true,
      environment: "production",
      stripeMode: "live",
    });
  });

  it("requires runtime and migration URLs to target the same production database", () => {
    const result = validateRuntimeConfiguration(
      {
        TX_LOCALIST_DATABASE_ENV: "production",
        DATABASE_URL:
          "postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/app",
        DATABASE_URL_UNPOOLED:
          "postgresql://user:password@ep-example.us-east-2.aws.neon.tech/other",
        NEXT_PUBLIC_SITE_URL: "https://txlocalist.example",
        CRON_SECRET: "a-production-cron-secret",
        STRIPE_SECRET_KEY: "sk_live_example",
        NEXT_PUBLIC_STRIPE_PK: "pk_live_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        STRIPE_PRICE_STARTER: "price_starter",
        BLOB_READ_WRITE_TOKEN: "blob-token",
      },
      { environment: "production" },
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      "DATABASE_TARGET_MISMATCH",
    );
  });

  it("requires the event price when event posting is enabled", () => {
    const result = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        EVENT_POSTING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_test_example",
        NEXT_PUBLIC_STRIPE_PK: "pk_test_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
      },
      { environment: "test" },
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      "INVALID_EVENT_PRICE",
    );
  });

  it("rejects unknown targets and declared environment mismatches", () => {
    const unknown = validateRuntimeConfiguration(TEST_DATABASE_ENV, {
      environment: "prod",
    });
    const mismatch = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        TX_LOCALIST_ENV: "development",
      },
      { environment: "test" },
    );

    expect(unknown.issues.map((issue) => issue.code)).toContain(
      "INVALID_TARGET_ENVIRONMENT",
    );
    expect(mismatch.issues.map((issue) => issue.code)).toContain(
      "RUNTIME_ENVIRONMENT_MISMATCH",
    );
  });

  it("requires the database deployment class to match the runtime", () => {
    const result = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        TX_LOCALIST_DATABASE_ENV: "production",
      },
      { environment: "test" },
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      "DATABASE_ENVIRONMENT_MISMATCH",
    );
  });

  it("rejects reserved rollout switches before their implementation phase", () => {
    const result = validateRuntimeConfiguration(
      {
        ...TEST_DATABASE_ENV,
        BILLING_MUTATION_FENCE_ENABLED: "true",
        EVENT_PAYMENT_RECONCILIATION_MODE: "repair",
        RESUME_UPLOAD_V2_ENABLED: "true",
        LEGACY_BLOB_PROXY_ENABLED: "false",
      },
      { environment: "test" },
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "RESERVED_ROLLOUT_SWITCH",
        "RESERVED_RECONCILIATION_MODE",
      ]),
    );
  });
});
