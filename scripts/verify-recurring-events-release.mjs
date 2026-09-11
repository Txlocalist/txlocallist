import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { validateRuntimeConfiguration } from "../src/lib/runtime-config.mjs";
import { REQUIRED_STRIPE_WEBHOOK_EVENTS } from "../src/lib/stripe-webhook-events.mjs";

export function migrationIssues(local, history) {
  const issues = [];
  for (const row of history) {
    if (!row.finished_at && !row.rolled_back_at) issues.push(`Unresolved migration: ${row.migration_name}`);
    if (row.finished_at && !row.rolled_back_at && !local.has(row.migration_name)) issues.push(`Database migration absent from release: ${row.migration_name}`);
  }
  for (const name of local) {
    const applied = history.find((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at);
    if (!applied) issues.push(`Pending migration: ${name}`);
  }
  return issues;
}

export function webhookIssues(endpoints, siteUrl) {
  const expected = new URL("/api/stripe/webhook", siteUrl).href;
  const matching = endpoints.filter((endpoint) => endpoint.url === expected && endpoint.status === "enabled" && endpoint.livemode === true && !endpoint.application);
  if (!matching.length) return ["No enabled live account webhook matches the production site URL."];
  // Every required event must reach a single destination, not a union of endpoints.
  if (matching.some((endpoint) => REQUIRED_STRIPE_WEBHOOK_EVENTS.every((event) => endpoint.enabled_events?.includes("*") || endpoint.enabled_events?.includes(event)))) return [];
  return matching.map((endpoint) => `Webhook ${endpoint.id} missing: ${REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((event) => !endpoint.enabled_events?.includes(event)).join(", ")}`);
}

export async function main(args = process.argv.slice(2)) {
  const vercelBuild = args.length === 1 && args[0] === "--vercel-build";
  if (vercelBuild && process.env.VERCEL !== "1") throw new Error("--vercel-build requires the Vercel build environment.");
  if (vercelBuild && process.env.VERCEL_ENV !== "production") {
    console.log("Non-production Vercel build: production release gate is not applicable.");
    return;
  }
  const envArg = args.find((arg) => arg.startsWith("--env-file="));
  if (!vercelBuild && (!envArg || args.length !== 1)) throw new Error("Use --env-file=<explicit production env file>. This check never loads .env.local or changes production.");
  // Do not merge with ambient/app env: .env.local belongs to a different database.
  const env = vercelBuild ? process.env : parse(readFileSync(resolve(envArg.slice(11)), "utf8"));
  const issues = validateRuntimeConfiguration(env, { environment: "production" }).issues.map((issue) => `${issue.code}: ${issue.message}`);
  if (Number(process.versions.node.split(".")[0]) !== 22) issues.push("Production checks and builds require Node 22.");
  const local = new Set(readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^\d/.test(entry.name)).map((entry) => entry.name));
  try {
    const direct = new URL(env.DATABASE_URL_UNPOOLED);
    const pooled = new URL(env.DATABASE_URL);
    const target = (url) => `${url.hostname.replace(/-pooler(?=\.)/, "")}:${url.port || "5432"}${url.pathname}`;
    if (target(direct) !== target(pooled)) throw new Error("mismatched database targets");
    console.log(`Database target fingerprint: ${createHash("sha256").update(target(direct)).digest("hex")}`);
    const sql = neon(env.DATABASE_URL_UNPOOLED);
    const history = await sql`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`;
    const databaseIssues = migrationIssues(local, history);
    issues.push(...databaseIssues);
    if (!databaseIssues.length) {
      await sql`SELECT "recurrence", "recurrenceUntil" FROM "Event" LIMIT 0`;
      const constraints = await sql`SELECT conname FROM pg_constraint WHERE conrelid='"Event"'::regclass AND conname='Event_recurrence_valid' AND convalidated`;
      if (!constraints.length) issues.push("Validated Event_recurrence_valid constraint is missing.");
      console.log("Migration history and recurrence columns verified.");
    }
  } catch {
    issues.push("Database verification failed. Check the explicit production connections, schema and read permissions; raw connection errors are withheld.");
  }
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")) {
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 });
      const endpoints = [];
      for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) endpoints.push(endpoint);
      issues.push(...webhookIssues(endpoints, env.NEXT_PUBLIC_SITE_URL));
    } catch {
      issues.push("Stripe endpoint verification failed. Check live read permissions; raw provider errors are withheld.");
    }
  } else issues.push("Live Stripe credentials and an HTTPS site URL are required for endpoint verification.");
  for (const issue of issues) console.error(`BLOCKED: ${issue}`);
  console.log(issues.length ? "Recurring-event release: NOT READY" : "Recurring-event automated release checks: PASS. Confirm backup, webhook signing/delivery and staging smoke tests before promotion.");
  process.exitCode = issues.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Release check failed. Verify the explicit env file and checkout; no production changes were made."); process.exitCode = 1; });
}
