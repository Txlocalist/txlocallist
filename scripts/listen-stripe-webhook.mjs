import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import nextEnv from "@next/env";

import {
  getRuntimeEnvironment,
  validateRuntimeConfiguration,
} from "../src/lib/runtime-config.mjs";
import { REQUIRED_STRIPE_WEBHOOK_EVENTS } from "../src/lib/stripe-webhook-events.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const environment = getRuntimeEnvironment(process.env);
const configuration = validateRuntimeConfiguration(process.env, { environment });

if (!configuration.ok) {
  console.error(`Refusing to start Stripe forwarding: ${environment} configuration is invalid.`);
  for (const issue of configuration.issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}

if (configuration.environment === "production" || configuration.stripeMode !== "test") {
  console.error("Refusing to start a local webhook listener without a non-production environment and Stripe test keys.");
  process.exit(1);
}

const forwardUrl = new URL(
  process.env.STRIPE_WEBHOOK_FORWARD_URL?.trim() ||
    "http://localhost:3000/api/stripe/webhook",
);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!loopbackHosts.has(forwardUrl.hostname)) {
  console.error("STRIPE_WEBHOOK_FORWARD_URL must target localhost or a loopback address.");
  process.exit(1);
}

if (!["http:", "https:"].includes(forwardUrl.protocol)) {
  console.error("STRIPE_WEBHOOK_FORWARD_URL must use HTTP or HTTPS.");
  process.exit(1);
}

if (forwardUrl.pathname !== "/api/stripe/webhook") {
  console.error("STRIPE_WEBHOOK_FORWARD_URL must end at /api/stripe/webhook.");
  process.exit(1);
}

const windowsUserInstall = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Programs", "StripeCLI", "stripe.exe")
  : "";
const executable = process.platform === "win32" && existsSync(windowsUserInstall)
  ? windowsUserInstall
  : process.platform === "win32"
    ? "stripe.exe"
    : "stripe";
const args = [
  "listen",
  "--events",
  REQUIRED_STRIPE_WEBHOOK_EVENTS.join(","),
  "--forward-to",
  forwardUrl.href,
];

console.log(`Starting Stripe test-event forwarding to ${forwardUrl.href}`);
console.log("Copy the whsec_ signing secret printed below into .env.local, then restart Next.js.");

const listener = spawn(executable, args, {
  shell: false,
  stdio: "inherit",
});

listener.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(
      "Stripe CLI is not installed. Follow Stripe's official Windows Scoop or versioned-archive instructions.",
    );
  } else {
    console.error(`Unable to start Stripe CLI: ${error.message}`);
  }
  process.exitCode = 1;
});

listener.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Stripe CLI stopped after receiving ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
