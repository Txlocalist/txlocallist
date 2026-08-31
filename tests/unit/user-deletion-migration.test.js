import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const schema = source("../../prisma/schema.prisma");
const migration = source(
  "../../prisma/migrations/20260828010000_user_account_deletion/migration.sql",
);
const deletionService = source("../../src/lib/user-deletion.js");
const sessionService = source("../../src/lib/auth/session.js");
const dialogStyles = source("../../src/app/admin/users/users.module.css");

describe("user account deletion infrastructure", () => {
  test("adds an indexed deletion tombstone", () => {
    expect(schema).toContain("deletedAt");
    expect(schema).toContain("@@index([deletedAt])");
    expect(migration).toContain('ADD COLUMN "deletedAt"');
    expect(migration).toContain('CREATE INDEX "User_deletedAt_idx"');
  });

  test("pseudonymizes the user while retaining auditable financial rows", () => {
    expect(deletionService).toContain("USER_ACCOUNT_DELETED");
    expect(deletionService).toContain("deleted.txlocalist.invalid");
    expect(deletionService).toContain('status: "ARCHIVED"');
    expect(deletionService).toContain("cancelEventPosting");
    expect(deletionService).not.toContain("tx.user.delete(");
  });

  test("rejects deleted accounts at the session boundary", () => {
    expect(sessionService).toContain("deletedAt: null");
    expect(sessionService).toContain("session.user.deletedAt");
  });

  test("centers native dialogs despite the global margin reset", () => {
    expect(dialogStyles).toMatch(
      /\.roleDialog\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*margin:\s*auto;/,
    );
  });
});
