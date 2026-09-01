import { defineConfig } from "@playwright/test";

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/txlocalist_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI
      ? "npm run start -- --hostname 127.0.0.1 --port 3100"
      : "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      TX_LOCALIST_ENV: "test",
      TX_LOCALIST_DATABASE_ENV: "test",
      DATABASE_URL: e2eDatabaseUrl,
      DATABASE_URL_UNPOOLED: e2eDatabaseUrl,
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
      NEXT_TELEMETRY_DISABLED: "1",
      STRIPE_SECRET_KEY: "",
      NEXT_PUBLIC_STRIPE_PK: "",
      STRIPE_WEBHOOK_SECRET: "",
      STRIPE_PRICE_STARTER: "",
      STRIPE_PRICE_EVENT_POST: "",
      BLOB_READ_WRITE_TOKEN: "",
      RESEND_API_KEY: "",
      CRON_SECRET: "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_GEMINI_API_KEY: "",
      SENTRY_DSN: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
      EVENT_POSTING_ENABLED: "false",
      SUBSCRIPTION_INVOICE_EVENTS_ENABLED: "false",
      PAST_DUE_ACCESS_ENABLED: "false",
      BILLING_MUTATION_FENCE_ENABLED: "false",
      COMPLIMENTARY_ROLE_MUTATIONS_ENABLED: "false",
      BUSINESS_PHOTO_UPLOAD_V2_ENABLED: "false",
      EVENT_IMAGE_UPLOAD_V2_ENABLED: "false",
      RESUME_UPLOAD_V2_ENABLED: "false",
      PUBLIC_MEDIA_READ_V2_ENABLED: "false",
      RESUME_RETENTION_DELETE_ENABLED: "false",
      LEGACY_BLOB_PROXY_ENABLED: "true",
      EVENT_PAYMENT_RECONCILIATION_MODE: "off",
      RATE_LIMIT_MODE: "observe",
      CSP_MODE: "report-only",
    },
  },
});

