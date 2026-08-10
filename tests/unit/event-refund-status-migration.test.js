import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260810004000_track_event_refund_status/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("event refund status migration", () => {
  it("additively records Stripe's refund lifecycle without rewriting local states", () => {
    expect(migration).toMatch(
      /ALTER TABLE "EventPayment"\s+ADD COLUMN "stripeRefundStatus" TEXT;/,
    );
    expect(migration).not.toMatch(/UPDATE\s+"EventPayment"/);
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/);
  });
});
