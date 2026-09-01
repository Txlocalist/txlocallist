import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

const { loadEnvConfig } = nextEnv;

// Match Next.js environment precedence so local Prisma commands cannot silently
// use .env while the application is connected through .env.local.
loadEnvConfig(
  process.cwd(),
  process.env.NODE_ENV !== "production",
);

const datasourceUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error(
    "Missing database env var. Set DATABASE_URL_UNPOOLED or DATABASE_URL.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
