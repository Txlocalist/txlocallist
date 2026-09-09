import { spawnSync } from "node:child_process";

const connectionString = process.env.LISTING_TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set LISTING_TEST_DATABASE_URL to a disposable local txlocalist_listing_test database.");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/txlocalist_listing_test") {
  throw new Error("Listing tests only accept the local txlocalist_listing_test database.");
}
const env = {
  ...process.env,
  DATABASE_URL: connectionString,
  DATABASE_URL_UNPOOLED: connectionString,
  TX_LOCALIST_ENV: "test",
  TX_LOCALIST_DATABASE_ENV: "test",
};
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/vitest/vitest.mjs", "run", "tests/integration/listing-management-db.test.js"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
