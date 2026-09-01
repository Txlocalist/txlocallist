import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";
import Stripe from "stripe";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function value(input) {
  return typeof input === "string" ? input.trim() : "";
}

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : "";
}

function isLoopback(hostname) {
  return new Set(["localhost", "127.0.0.1", "[::1]"]).has(hostname);
}

async function readSecretFromStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return value(input);
}

async function run() {
  if (!process.argv.includes("--confirm-sandbox-local-replay")) {
    throw new Error(
      "Refusing to replay without --confirm-sandbox-local-replay.",
    );
  }

  const stripeKey = value(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.argv.includes("--webhook-secret-stdin")
    ? await readSecretFromStdin()
    : value(process.env.STRIPE_WEBHOOK_SECRET);
  const eventId = getArgument("event-id");
  const target = new URL(
    getArgument("target") || "http://127.0.0.1:3000/api/stripe/webhook",
  );

  if (process.env.NODE_ENV === "production" || !stripeKey.startsWith("sk_test_")) {
    throw new Error("Webhook replay requires a non-production Stripe test key.");
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be a whsec_ signing secret.");
  }
  if (!eventId.startsWith("evt_") || !isLoopback(target.hostname)) {
    throw new Error("Provide a Stripe event ID and a loopback-only target URL.");
  }
  if (target.pathname !== "/api/stripe/webhook") {
    throw new Error("The replay target must end at /api/stripe/webhook.");
  }

  const stripe = new Stripe(stripeKey, {
    appInfo: { name: "tx-localist-sandbox-webhook-replay" },
  });
  const stripeEvent = await stripe.events.retrieve(eventId);
  if (stripeEvent.livemode) {
    throw new Error("Refusing to replay a live-mode Stripe event.");
  }

  const payload = JSON.stringify(stripeEvent);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  const responseBody = await response.text();
  console.log(`Replay response: ${response.status} ${responseBody}`);
  if (!response.ok) process.exitCode = 1;
}

const entryPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (entryPath === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
