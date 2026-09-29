import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const harness = await vi.hoisted(async () => {
  const url = process.env.LISTING_TEST_DATABASE_URL;
  if (!url) return { db: null, admin: null };
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/txlocalist_listing_test") {
    throw new Error("Import tests require the disposable local txlocalist_listing_test database.");
  }
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { db: new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), admin: null };
});
vi.mock("@/lib/prisma", () => ({ prisma: harness.db }));
vi.mock("@/lib/auth/session", () => ({ requireAdmin: async () => harness.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  previewImportedBusinesses, publishImportedBusinesses, searchImportedBusinesses,
  getImportedBusinessCategories, getImportAdminState, exportImportedBusinesses,
} from "@/lib/imported-businesses";
import { getPublicBusinessWhere } from "@/lib/listing-visibility";
import { getPublicBusinessSql } from "@/lib/listing-visibility-sql";
import { deleteCityAction } from "@/app/actions/cities";

const db = harness.db;
const prefix = `import_${randomUUID()}`;
let city, otherCity, category, otherCategory, owner, plan;
const csv = (rows) => new File(["Name,City,Category\r\n" + rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")], "businesses.csv", { type: "text/csv" });
const sheet = (names = ["Corner Shop"]) => csv(names.map((name) => [name, city.name, category.name]));
async function publish(file) {
  const preview = await previewImportedBusinesses(file);
  expect(preview.canPublish).toBe(true);
  return publishImportedBusinesses(file, preview, harness.admin);
}
async function business(name, extra = {}) {
  return db.business.create({ data: {
    slug: `${prefix}-${randomUUID()}`, name, description: "Test business", address: "1 Main St", zipCode: "78701",
    cityId: city.id, ownerId: owner.id, status: "ACTIVE", publishedAt: new Date(), ...extra,
  } });
}

describe.skipIf(!db)("spreadsheet directory against PostgreSQL", () => {
  beforeAll(async () => {
    city = await db.city.create({ data: { name: `Import Austin ${prefix}`, slug: `${prefix}-austin`, state: "Texas" } });
    otherCity = await db.city.create({ data: { name: `Import Dallas ${prefix}`, slug: `${prefix}-dallas`, state: "Texas" } });
    category = await db.category.create({ data: { name: `Coffee ${prefix}`, slug: `${prefix}-coffee` } });
    otherCategory = await db.category.create({ data: { name: `Shops ${prefix}`, slug: `${prefix}-shops` } });
    harness.admin = await db.user.create({ data: { email: `${prefix}-admin@example.test`, passwordHash: "unused", role: "ADMIN" } });
    owner = await db.user.create({ data: { email: `${prefix}-owner@example.test`, passwordHash: "unused", role: "COMPLIMENTARY" } });
    plan = await db.plan.create({ data: { slug: prefix, name: "Import test", tier: 1, priceCents: 1000 } });
  });
  beforeEach(async () => {
    await db.importedBusiness.deleteMany();
    await db.business.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.businessImportState.upsert({ where: { id: "directory" }, create: { id: "directory" },
      update: { revision: 0, lastFileName: null, lastImportedAt: null, lastFileHash: null, lastImportedBy: null } });
    await db.auditLog.deleteMany({ where: { actorId: harness.admin.id } });
  });
  afterAll(async () => {
    await db.importedBusiness.deleteMany();
    await db.business.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.city.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.category.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.plan.deleteMany({ where: { slug: prefix } });
    await db.auditLog.deleteMany({ where: { actorId: harness.admin.id } });
    await db.$disconnect();
  });

  it("previews without mutations, replaces the full sheet, exports and audits the result", async () => {
    const file = sheet(["First", "Second"]);
    const preview = await previewImportedBusinesses(file);
    expect(preview).toMatchObject({ canPublish: true, revision: 0, summary: { total: 2, added: 2, removed: 0 } });
    expect(await db.importedBusiness.count()).toBe(0);
    await publishImportedBusinesses(file, preview, harness.admin);
    const changedFile = csv([["Second", city.name, otherCategory.name], ["Third", city.name, category.name]]);
    const changes = await previewImportedBusinesses(changedFile);
    expect(changes.summary).toMatchObject({ added: 1, changed: 1, removed: 1, unchanged: 0 });
    await publishImportedBusinesses(changedFile, changes, harness.admin);
    expect(await exportImportedBusinesses()).toEqual([
      { name: "Second", city: city.name, category: otherCategory.name },
      { name: "Third", city: city.name, category: category.name },
    ]);
    expect(await getImportAdminState()).toMatchObject({ revision: 2, total: 2, lastFileName: "businesses.csv" });
    expect(await db.auditLog.count({ where: { actorId: harness.admin.id, action: "IMPORT_REPLACE" } })).toBe(2);
  });

  it("rejects unknown taxonomy and duplicate names using database case folding", async () => {
    await publish(sheet(["Keep"]));
    const file = csv([[" Shop ", city.name.toUpperCase(), category.name], ["shop", city.name, category.name], ["Unknown", "Missing City", "Missing Category"]]);
    const preview = await previewImportedBusinesses(file);
    expect(preview).toMatchObject({ canPublish: false, issueCount: 3 });
    expect(preview.issues.map((issue) => issue.field)).toEqual(["Name", "City", "Category"]);
    await expect(publishImportedBusinesses(file, preview, harness.admin)).rejects.toMatchObject({ status: 400 });
    expect((await exportImportedBusinesses()).map((row) => row.name)).toEqual(["Keep"]);
  });

  it("binds publication to the reviewed file and rejects stale revisions and double submissions", async () => {
    const file = sheet();
    const preview = await previewImportedBusinesses(file);
    await expect(publishImportedBusinesses(sheet(["Changed"]), preview, harness.admin)).rejects.toMatchObject({ status: 409 });
    await publishImportedBusinesses(file, preview, harness.admin);
    await expect(publishImportedBusinesses(file, preview, harness.admin)).rejects.toMatchObject({ status: 409 });
    expect(await db.auditLog.count({ where: { actorId: harness.admin.id, action: "IMPORT_REPLACE" } })).toBe(1);
  });

  it("rejects a stale taxonomy snapshot and keeps rows linked through renames", async () => {
    await publish(sheet());
    const file = sheet(["Replacement"]);
    const preview = await previewImportedBusinesses(file);
    const newName = `${category.name} renamed`;
    await db.category.update({ where: { id: category.id }, data: { name: newName } });
    try {
      await expect(publishImportedBusinesses(file, preview, harness.admin)).rejects.toMatchObject({ status: 409 });
      expect((await searchImportedBusinesses({ citySlug: city.slug })).results[0].category.name).toBe(newName);
    } finally { await db.category.update({ where: { id: category.id }, data: { name: category.name } }); }
  });

  it("allows only one concurrent publish from a shared revision", async () => {
    const a = sheet(["A"]), b = sheet(["B"]);
    const previews = await Promise.all([previewImportedBusinesses(a), previewImportedBusinesses(b)]);
    const results = await Promise.allSettled([publishImportedBusinesses(a, previews[0], harness.admin), publishImportedBusinesses(b, previews[1], harness.admin)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected").reason.status).toBe(409);
    expect((await getImportAdminState()).revision).toBe(1);
  });

  it("rolls back rows and revision when audit persistence fails", async () => {
    await publish(sheet(["Keep"]));
    const file = sheet(["Discard"]), preview = await previewImportedBusinesses(file);
    const transaction = db.$transaction.bind(db);
    vi.spyOn(db, "$transaction").mockImplementationOnce((work, options) => transaction((tx) => work(new Proxy(tx, {
      get(target, prop) { return prop === "auditLog" ? { create: async () => { throw new Error("Audit failure"); } } : target[prop]; },
    })), options));
    await expect(publishImportedBusinesses(file, preview, harness.admin)).rejects.toThrow("Audit failure");
    expect((await exportImportedBusinesses()).map((row) => row.name)).toEqual(["Keep"]);
    expect((await getImportAdminState()).revision).toBe(1);
  });

  it("rejects publication without an administrator even when called directly", async () => {
    await expect(publishImportedBusinesses(sheet(), {}, owner)).rejects.toMatchObject({ status: 403 });
  });

  it("suppresses matches across full listing categories before count and pagination, then restores them", async () => {
    const names = Array.from({ length: 31 }, (_, index) => `Shop ${String(index).padStart(2, "0")}`);
    const full = await business("  SHOP 00  ");
    await publish(csv([...names.map((name) => [name, city.name, category.name]), ["Shop 00", otherCity.name, category.name]]));
    const data = await searchImportedBusinesses({ citySlug: city.slug, category: category.slug });
    expect(data).toMatchObject({ total: 30, pageSize: 25, hasMore: true });
    expect(data.results[0].name).toBe("Shop 01");
    expect((await searchImportedBusinesses({ citySlug: city.slug, page: 2 })).results).toHaveLength(5);
    expect((await searchImportedBusinesses({ citySlug: otherCity.slug })).total).toBe(1);
    expect(await db.importedBusiness.count()).toBe(32);
    await db.business.update({ where: { id: full.id }, data: { deletedAt: new Date() } });
    expect((await searchImportedBusinesses({ citySlug: city.slug })).total).toBe(31);
  });

  it("filters keyword/category/city together and exposes imported-only categories", async () => {
    await publish(csv([["Café & Tea", city.name, category.name], ["Books", otherCity.name, otherCategory.name]]));
    expect((await searchImportedBusinesses({ q: "CAFÉ", loc: `${city.name}, TX`, category: category.slug })).total).toBe(1);
    expect((await searchImportedBusinesses({ q: "coffee", citySlug: city.slug })).total).toBe(1);
    expect((await searchImportedBusinesses({ q: "%" })).total).toBe(0);
    expect((await searchImportedBusinesses({ category: "missing" })).total).toBe(0);
    expect((await getImportedBusinessCategories()).map((row) => row.id)).toContain(category.id);
    await business("Café & Tea");
    expect((await getImportedBusinessCategories()).map((row) => row.id)).not.toContain(category.id);
    expect((await exportImportedBusinesses())).toHaveLength(2);
  });

  it("matches Prisma public visibility across account and legacy subscription cases", async () => {
    const scenarios = [
      { role: "ADMIN" }, { role: "MANAGER" }, { role: "COMPLIMENTARY" }, { role: "USER" },
      { role: "USER", billingStatus: "ACTIVE", stripeSubscriptionId: randomUUID() },
      { role: "USER", billingStatus: "TRIALING", stripeSubscriptionId: randomUUID() },
      { role: "USER", billingStatus: "PAST_DUE", stripeSubscriptionId: randomUUID() },
      { role: "USER", billingStatus: "ACTIVE", stripeSubscriptionId: null },
      { role: "USER", billingStatus: "ACTIVE", stripeSubscriptionId: randomUUID(), cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2000-01-01") },
      { role: "USER", billingStatus: "ACTIVE", stripeSubscriptionId: randomUUID(), cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2100-01-01") },
      { role: "USER", billingStatus: "ACTIVE", stripeSubscriptionId: randomUUID(), cancelAtPeriodEnd: true, currentPeriodEnd: null },
      { role: "ADMIN", deletedAt: new Date() },
    ];
    for (const [index, data] of scenarios.entries()) {
      const user = await db.user.create({ data: { email: `${prefix}-${randomUUID()}@example.test`, passwordHash: "unused", ...data } });
      await business(`Eligibility ${index}`, { ownerId: user.id });
    }
    for (const [index, status] of ["ACTIVE", "TRIALING", "PAST_DUE"].entries()) {
      const user = await db.user.create({ data: { email: `${prefix}-${randomUUID()}@example.test`, passwordHash: "unused" } });
      const legacy = await business(`Legacy ${index}`, { ownerId: user.id });
      await db.subscription.create({ data: { businessId: legacy.id, planId: plan.id, status, stripeSubscriptionId: randomUUID() } });
    }
    await business("Draft", { status: "DRAFT" });
    await business("Unpublished", { publishedAt: null });
    await business("Deleted", { deletedAt: new Date() });
    const prismaRows = await db.business.findMany({ where: { cityId: city.id, ...getPublicBusinessWhere() }, select: { id: true } });
    const sqlRows = await db.$queryRaw`SELECT b."id" FROM "Business" b JOIN "User" u ON u."id" = b."ownerId"
      WHERE b."cityId" = ${city.id} AND ${getPublicBusinessSql()}`;
    expect(sqlRows.map((row) => row.id).sort()).toEqual(prismaRows.map((row) => row.id).sort());
  });

  it("reassigns imports on city deletion and invalidates previews", async () => {
    const doomed = await db.city.create({ data: { name: `Doomed ${prefix}`, slug: `${prefix}-doomed`, state: "Texas" } });
    const fallback = await db.city.upsert({ where: { slug: "uncategorized" }, update: {}, create: { slug: "uncategorized", name: "Uncategorized", state: "Texas" } });
    const file = csv([["Moved", doomed.name, category.name], ["Keep", fallback.name, category.name]]);
    await publish(file);
    const preview = await previewImportedBusinesses(file);
    const form = new FormData();
    Object.entries({ cityId: doomed.id, expectedName: doomed.name, confirmed: "yes" }).forEach(([key, value]) => form.set(key, value));
    expect((await deleteCityAction(null, form)).error).toBe("");
    expect(await db.importedBusiness.count({ where: { cityId: fallback.id } })).toBe(2);
    await expect(publishImportedBusinesses(file, preview, harness.admin)).rejects.toMatchObject({ status: 409 });
    const current = await exportImportedBusinesses();
    expect((await previewImportedBusinesses(csv(current.map(({ name, city, category }) => [name, city, category])))).canPublish).toBe(true);
  });

  it("preserves city and listings when deletion would create duplicate imports in Uncategorized", async () => {
    const doomed = await db.city.create({ data: { name: `Collision ${prefix}`, slug: `${prefix}-collision`, state: "Texas" } });
    const fallback = await db.city.upsert({ where: { slug: "uncategorized" }, update: {}, create: { slug: "uncategorized", name: "Uncategorized", state: "Texas" } });
    await publish(csv([["Same", doomed.name, category.name], ["same", fallback.name, otherCategory.name]]));
    const full = await business("Full listing", { cityId: doomed.id });
    const form = new FormData();
    Object.entries({ cityId: doomed.id, expectedName: doomed.name, confirmed: "yes" }).forEach(([key, value]) => form.set(key, value));
    expect((await deleteCityAction(null, form)).error).toContain("master spreadsheet");
    expect(await db.city.findUnique({ where: { id: doomed.id } })).not.toBeNull();
    expect((await db.business.findUnique({ where: { id: full.id } })).cityId).toBe(doomed.id);
    expect((await getImportAdminState()).revision).toBe(1);
  });

  it("publishes and queries a complete 10,000-row spreadsheet", async () => {
    const file = sheet(Array.from({ length: 10000 }, (_, index) => `Business ${String(index).padStart(5, "0")}`));
    const start = performance.now();
    const state = await publish(file);
    expect(state.total).toBe(10000);
    expect((await searchImportedBusinesses({ page: 400 }))).toMatchObject({ total: 10000, hasMore: false });
    console.info(`10,000-row preview + atomic publish: ${Math.round(performance.now() - start)} ms`);
  }, 45000);
});
