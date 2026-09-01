import nextEnv from "@next/env";

import {
  getRuntimeEnvironment,
  validateRuntimeConfiguration,
} from "../src/lib/runtime-config.mjs";

const requestedEnvironment = process.argv
  .find((argument) => argument.startsWith("--environment="))
  ?.slice("--environment=".length);

const { loadEnvConfig } = nextEnv;
loadEnvConfig(
  process.cwd(),
  requestedEnvironment !== "production" && process.env.NODE_ENV !== "production",
);

const environment = requestedEnvironment || getRuntimeEnvironment(process.env);
const result = validateRuntimeConfiguration(process.env, { environment });

if (result.ok) {
  console.log(`Runtime configuration (${result.environment}): OK`);
} else {
  console.error(`Runtime configuration (${result.environment}): FAILED`);
  for (const issue of result.issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
  process.exitCode = 1;
}
