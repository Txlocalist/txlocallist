import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/pricing",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      EVENT_POSTING_ENABLED: "true",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
    },
  },
});

