import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

// Keep every local script on the same precedence as Next.js: process values,
// then .env.local, then the environment-specific file, then .env.
loadEnvConfig(
  process.cwd(),
  process.env.NODE_ENV !== "production",
);
