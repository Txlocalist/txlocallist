import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui", testMatch: "*.spec.js", fullyParallel: true,
  workers: 2,
  outputDir: "test-results/listing-ui", reporter: "list",
  use: { baseURL: "http://127.0.0.1:3199", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: { command: "npx vite --config tests/ui/vite.config.mjs", url: "http://127.0.0.1:3199", reuseExistingServer: false },
});
