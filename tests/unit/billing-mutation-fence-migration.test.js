import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260901000000_billing_mutation_fence/migration.sql",
  ),
  "utf8",
);

describe("billing mutation fence migration", () => {
  test("creates one durable mutation owner per user with recoverable expiry", () => {
    expect(migration).toContain('CREATE TYPE "BillingMutationKind"');
    expect(migration).toContain('CREATE TABLE "BillingMutationFence"');
    expect(migration).toContain('PRIMARY KEY ("userId")');
    expect(migration).toContain('"operationKey" TEXT NOT NULL');
    expect(migration).toContain('"expiresAt" TIMESTAMP(3)');
    expect(migration).toContain('REFERENCES "User"("id")');
  });
});
