import nextEnv from "@next/env";

import {
  getRuntimeEnvironment,
  validateRuntimeConfiguration,
} from "../src/lib/runtime-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const environment = getRuntimeEnvironment(process.env);
const configuration = validateRuntimeConfiguration(process.env, { environment });
const issues = configuration.issues.map((issue) => ({ ...issue }));

if (configuration.environment === "production") {
  issues.push({
    code: "LOCAL_WEBHOOK_PRODUCTION_ENVIRONMENT",
    message: "This check is for local or Preview test-mode webhook configuration only.",
  });
}

if (configuration.stripeMode !== "test") {
  issues.push({
    code: "LOCAL_WEBHOOK_STRIPE_MODE",
    message: "Stripe test-mode secret and publishable keys are required.",
  });
}

if (!process.env.STRIPE_WEBHOOK_SECRET?.trim().startsWith("whsec_")) {
  issues.push({
    code: "MISSING_WEBHOOK_SIGNING_SECRET",
    message: "STRIPE_WEBHOOK_SECRET must contain the whsec_ value for this listener or endpoint.",
  });
}

if (issues.length > 0) {
  console.error(`Stripe webhook configuration (${configuration.environment}): FAILED`);
  for (const issue of issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`Stripe webhook configuration (${configuration.environment}): OK`);
console.log("This confirms safe key modes and secret presence; it does not prove delivery. Complete a signed delivery smoke test next.");
