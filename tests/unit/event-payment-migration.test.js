import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260810001000_one_active_event_checkout/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("active event Checkout migration", () => {
  it("fails with recovery guidance before enforcing one active attempt per event", () => {
    expect(migration).toContain("duplicate_event_count");
    expect(migration).toContain("EVENT_POSTING_ENABLED=false");
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX[\s\S]+WHERE "status" IN \('CREATED', 'PROCESSING'\)/,
    );
  });
});
