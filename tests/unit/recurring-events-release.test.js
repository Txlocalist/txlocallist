import { afterEach, describe, expect, it, vi } from "vitest";
import { main, migrationIssues, webhookIssues } from "../../scripts/verify-recurring-events-release.mjs";
import { REQUIRED_STRIPE_WEBHOOK_EVENTS } from "../../src/lib/stripe-webhook-events.mjs";

describe("recurring-event release checks", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects the Vercel-only entry point outside Vercel", async () => {
    vi.stubEnv("VERCEL", "");
    await expect(main(["--vercel-build"])).rejects.toThrow("requires the Vercel");
  });
  it("does not access production services during a preview build", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(main(["--vercel-build"])).resolves.toBeUndefined();
  });
  const local = new Set(["migration"]);
  const applied = { migration_name: "migration", checksum: "checksum", finished_at: new Date(), rolled_back_at: null };
  const endpoint = { id: "we_fixture", url: "https://example.com/api/stripe/webhook", status: "enabled", livemode: true, enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS] };
  it("accepts matching applied migrations", () => expect(migrationIssues(local, [applied])).toEqual([]));
  it("blocks pending and rolled-back migrations", () => {
    expect(migrationIssues(local, [])).toContain("Pending migration: migration");
    expect(migrationIssues(local, [{ ...applied, rolled_back_at: new Date() }])).toContain("Pending migration: migration");
  });
  it("blocks unresolved and unknown migrations", () => {
    expect(migrationIssues(local, [{ ...applied, finished_at: null }])).toContain("Unresolved migration: migration");
    expect(migrationIssues(local, [applied, { ...applied, migration_name: "future" }])).toContain("Database migration absent from release: future");
  });
  it("accepts all required events or a wildcard", () => {
    expect(webhookIssues([endpoint], "https://example.com")).toEqual([]);
    expect(webhookIssues([{ ...endpoint, enabled_events: ["*"] }], "https://example.com")).toEqual([]);
  });
  it("rejects test, disabled, wrong-site and Connect endpoints", () => {
    for (const changes of [{ livemode: false }, { status: "disabled" }, { url: "https://another.example/api/stripe/webhook" }, { application: "ca_example" }]) expect(webhookIssues([{ ...endpoint, ...changes }], "https://example.com")).not.toEqual([]);
  });
  it("requires invoice events on the same endpoint", () => {
    const partial = { ...endpoint, enabled_events: REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((name) => name !== "invoice.payment_failed") };
    expect(webhookIssues([partial, { ...endpoint, enabled_events: ["invoice.payment_failed"] }], "https://example.com").join(" ")).toContain("invoice.payment_failed");
  });
});
