import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260828000000_complimentary_manager_roles/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("complimentary and manager role migration", () => {
  test("maps every legacy Owner to User while retaining an audit record", () => {
    expect(migration).toContain("ROLE_MIGRATION_OWNER_TO_USER");
    expect(migration).toContain("WHEN \"role\"::text = 'OWNER' THEN 'USER'");
  });

  test("installs only the final four application roles", () => {
    expect(migration).toContain(
      "CREATE TYPE \"Role_new\" AS ENUM ('USER', 'COMPLIMENTARY', 'MANAGER', 'ADMIN')",
    );
  });

  test("adds durable transition and per-subscription tracking", () => {
    expect(migration).toContain('CREATE TABLE "RoleTransitionOperation"');
    expect(migration).toContain('CREATE TABLE "RoleTransitionSubscription"');
    expect(migration).toContain('"activeTargetKey" TEXT');
    expect(migration).toContain(
      '"RoleTransitionSubscription_operationId_stripeSubscriptionId_key"',
    );
  });
});
