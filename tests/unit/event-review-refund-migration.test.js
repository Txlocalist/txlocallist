import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260819000000_manual_event_refunds_and_reviews/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("manual event refund and review-history migration", () => {
  it("adds review history, payment totals, and admin refund audit fields additively", () => {
    expect(migration).toContain("'REVIEW_REQUIRED'");
    expect(migration).toContain('CREATE TABLE "EventReview"');
    expect(migration).toContain('"chargedAmountCents" INTEGER');
    expect(migration).toContain('"taxAmountCents" INTEGER');
    expect(migration).toContain('"refundApprovedById" TEXT');
    expect(migration).toContain('"refundApprovedAt" TIMESTAMP(3)');
    expect(migration).toContain('"refundReason" TEXT');
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/);
  });

  it("preserves legacy denial history", () => {
    expect(migration).toMatch(/INSERT INTO "EventReview"[\s\S]+WHERE "status" = 'DENIED'/);
  });
});
