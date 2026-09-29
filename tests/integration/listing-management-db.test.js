import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt in with a migrated, disposable local database; never use application env URLs.
const harness = await vi.hoisted(async () => {
  const url = process.env.LISTING_TEST_DATABASE_URL;
  if (!url) return { db: null, userId: null };
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/txlocalist_listing_test") {
    throw new Error("Listing tests require the disposable local txlocalist_listing_test database.");
  }
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return { db: new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }), userId: null };
});
vi.mock("@/lib/prisma", () => ({ prisma: harness.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/email", () => ({ sendListingPublishedEmail: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => false,
  getStripe: () => { throw new Error("Network payments are forbidden in listing tests"); },
  getSiteUrl: () => "http://localhost",
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => harness.db.user.findUnique({ where: { id: harness.userId } }),
  requireUser: () => harness.db.user.findUniqueOrThrow({ where: { id: harness.userId } }),
  requireAdmin: async () => {
    const user = await harness.db.user.findUniqueOrThrow({ where: { id: harness.userId } });
    if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
    return user;
  },
  requireStaff: async () => {
    const user = await harness.db.user.findUniqueOrThrow({ where: { id: harness.userId } });
    if (!["ADMIN", "MANAGER"].includes(user.role)) throw new Error("FORBIDDEN");
    return user;
  },
}));

import { deleteOwnedBusinessAction, deleteOwnedEventAction } from "@/app/actions/listing-deletion";
import { createBusinessFromFormAction, publishBusinessAction, updateBusinessAction } from "@/app/actions/businesses";
import { createEventAction, updateEventAction, resubmitEventAction } from "@/app/actions/events";
import { approveEventForPublication } from "@/lib/event-payments";
import { getNextEventOccurrence } from "@/lib/event-recurrence";
import { getPublicEventWhere } from "@/lib/event-dates";
import { activateBusinessAction, updatePostModerationStatusAction } from "@/app/actions/admin";
import { createCityAction, renameCityAction, deleteCityAction } from "@/app/actions/cities";
import { getSelectableCities, resolveEventCity } from "@/lib/cities.server";
import { createCategoryAction, renameCategoryAction } from "@/app/actions/categories";
import { getEventCategoryOptions } from "@/lib/categories.server";
import { getAccountAccess } from "@/lib/account-access";
import { syncStripeSubscriptionObject } from "@/lib/billing";
import { getPublicBusinessWhere, getPublicEventAccessWhere, getOwnedEventWhere } from "@/lib/listing-visibility";
import { resultOrderBy } from "@/lib/results-sort";
import { getEventsPageData, getEventById, filterEvents } from "@/lib/events";
import { GET as searchBusinesses } from "@/app/api/search/route";
import { GET as searchEvents } from "@/app/api/events/route";

const db = harness.db;
const prefix = `listing_${Date.now()}_`;
let sequence = 0;
const id = () => `${prefix}${++sequence}`;
let owner, other, admin, city, business, event, starter;
const managedCityIds = [];
const managedCategoryIds = { business: [], event: [] };
const form = (values) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };
const publicBusiness = () => db.business.findFirst({ where: { id: business.id, ...getPublicBusinessWhere() } });
const publicEvent = () => db.event.findFirst({ where: { id: event.id, ...getPublicEventAccessWhere() } });
const businessInput = () => ({ name: "Updated business", description: "A local shop with useful items for the whole family.", cityId: city.id });
const eventInput = () => form({ eventId: event.id, title: "Updated event", description: "A gathering of neighbors with music and local food.", category: "Community", address: "123 Main St", zipCode: "78701", city: city.name, startDate: "2030-01-10T10:00", endDate: "2030-01-10T11:00", timezone: "America/Chicago" });
async function addManagedCity() {
  harness.userId = admin.id;
  const name = `Managed ${id().replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit))).replaceAll("_", " ")}`;
  expect((await createCityAction(null, form({ name }))).error).toBe("");
  const created = await db.city.findUniqueOrThrow({ where: { name } });
  managedCityIds.push(created.id);
  return created;
}
const cityInput = (target, extra = {}) => form({ cityId: target.id, expectedName: target.name, ...extra });
async function addManagedCategory(type, name = `Category ${id().replaceAll("_", " ")}`) {
  harness.userId = admin.id;
  expect((await createCategoryAction(null, form({ type, name }))).error).toBe("");
  const created = await db[type === "business" ? "category" : "eventCategory"].findUniqueOrThrow({ where: { name } });
  managedCategoryIds[type].push(created.id);
  return created;
}

// These exercise the real Prisma filters, transactions, generated columns and server actions.
describe.skipIf(!db)("listing management against PostgreSQL", () => {
  beforeAll(async () => {
    for (const [slug, tier, priceCents] of [["free", 0, 0], ["starter", 1, 1000]]) {
      await db.plan.upsert({ where: { slug }, update: {}, create: { name: slug, slug, tier, priceCents, stripePriceId: slug === "starter" ? "price_listing_test" : null } });
    }
    starter = await db.plan.findUnique({ where: { slug: "starter" } });
    city = await db.city.create({ data: { name: `Test City ${prefix}`, slug: prefix, state: "Texas" } });
  });
  beforeEach(async () => {
    owner = await db.user.create({ data: { id: id(), email: `${id()}@example.test`, passwordHash: "unused", billingStatus: "ACTIVE", stripeSubscriptionId: id(), accountPlanId: starter.id } });
    other = await db.user.create({ data: { id: id(), email: `${id()}@example.test`, passwordHash: "unused", role: "COMPLIMENTARY" } });
    admin = await db.user.create({ data: { id: id(), email: `${id()}@example.test`, passwordHash: "unused", role: "ADMIN" } });
    harness.userId = owner.id;
    business = await db.business.create({ data: { id: id(), name: "Original business", slug: id(), description: "A local shop with useful items.", address: "123 Main St", zipCode: "78701", cityId: city.id, ownerId: owner.id, planId: starter.id, status: "ACTIVE", publishedAt: new Date() } });
    event = await db.event.create({ data: { id: id(), title: "Original event", description: "A gathering for the community.", imageUrl: "", addressName: "Town Hall", address: "123 Main St", zipCode: "78701", city: city.name, state: "TX", creatorId: owner.id, businessId: business.id, status: "PUBLISHED", postingMethod: "SUBSCRIPTION", publishedAt: new Date(), startDate: new Date("2030-01-10T15:00:00Z"), endDate: new Date("2030-01-10T23:00:00Z") } });
  });
  afterAll(async () => {
    await db.eventPayment.deleteMany({ where: { userId: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.category.deleteMany({ where: { id: { in: managedCategoryIds.business } } });
    await db.eventCategory.deleteMany({ where: { id: { in: managedCategoryIds.event } } });
    await db.city.deleteMany({ where: { OR: [{ id: { in: [city.id, ...managedCityIds] } }, { slug: { startsWith: "test-empty-" } }, { slug: "uncategorized" }] } });
    await db.auditLog.deleteMany({ where: { actorId: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it("runs the migration over archived data and retains canceled events", async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Business" ("id" TEXT, "name" TEXT, "status" TEXT, "updatedAt" TIMESTAMP(3)) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Event" ("id" TEXT, "title" TEXT, "status" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "User" ("id" TEXT, "name" TEXT, "email" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe(`INSERT INTO "Business" VALUES ('archived', 'Zebra', 'ARCHIVED', '2026-01-01'), ('active', 'Alpha', 'ACTIVE', '2026-02-01')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Event" VALUES ('cancelled', 'Canceled event', 'CANCELLED')`);
      await tx.$executeRawUnsafe(`INSERT INTO "User" VALUES ('named', 'Alice', 'z@example.test'), ('unnamed', NULL, 'a@example.test')`);
      const sql = readFileSync(new URL("../../prisma/migrations/20260910000000_listing_soft_deletion/migration.sql", import.meta.url), "utf8");
      for (const statement of sql.replace(/^--.*$/gm, "").split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
      const rows = await tx.$queryRawUnsafe('SELECT * FROM "Business" ORDER BY "sortName"');
      expect(rows[0]).toMatchObject({ id: "active", deletedAt: null, sortName: "alpha" });
      expect(rows[1].deletedAt).toEqual(rows[1].updatedAt);
      expect((await tx.$queryRawUnsafe('SELECT "deletedAt" FROM "Event"'))[0].deletedAt).toBeNull();
      expect(await tx.$queryRawUnsafe('SELECT "id" FROM "User" ORDER BY "sortName", "id"')).toEqual([{ id: "unnamed" }, { id: "named" }]);
    });
  });

  it("handles simultaneous deletion retries with one audit record per listing", async () => {
    await Promise.all([1, 2].map(() => deleteOwnedBusinessAction({ id: business.id, confirmed: true })));
    const results = await Promise.all([1, 2].map(() => deleteOwnedEventAction({ id: event.id, confirmed: true })));
    expect(results.every((result) => result.success)).toBe(true);
    expect(await db.auditLog.count({ where: { entityId: business.id, action: "OWNER_DELETE" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: event.id, action: "OWNER_DELETE" } })).toBe(1);
  });

  it("prevents an event edit from winning a concurrent deletion", async () => {
    const read = db.event.findUnique.bind(db.event);
    vi.spyOn(db.event, "findUnique").mockImplementationOnce(async (args) => {
      const stale = await read(args);
      await deleteOwnedEventAction({ id: event.id, confirmed: true });
      return stale;
    });
    const input = eventInput();
    input.set("businessId", business.id);
    expect((await updateEventAction(null, input)).error).toContain("changed in another request");
    expect(await publicEvent()).toBeNull();
    expect((await read({ where: { id: event.id } })).title).toBe("Original event");
  });

  it("preserves legacy subscription access and separately purchased events after business deletion", async () => {
    await db.user.update({ where: { id: owner.id }, data: { billingStatus: "CANCELED" } });
    await db.subscription.create({ data: { businessId: business.id, planId: starter.id, stripeSubscriptionId: id(), status: "ACTIVE" } });
    expect((await getAccountAccess(owner.id)).hasCreatorAccess).toBe(true);
    expect(await publicBusiness()).not.toBeNull();
    await db.event.update({ where: { id: event.id }, data: { postingMethod: "ONE_TIME" } });
    await deleteOwnedBusinessAction({ id: business.id, confirmed: true });
    expect(await publicEvent()).not.toBeNull();
  });

  it("requires confirmation and ownership, even for another entitled user", async () => {
    expect((await deleteOwnedBusinessAction({ id: business.id })).success).toBe(false);
    expect((await deleteOwnedEventAction({ id: event.id })).success).toBe(false);
    harness.userId = other.id;
    expect((await updateBusinessAction(business.id, businessInput())).success).toBe(false);
    expect((await publishBusinessAction(business.id)).success).toBe(false);
    expect((await updateEventAction(null, eventInput())).error).toBe("Event not found.");
    await expect(resubmitEventAction(form({ eventId: event.id }))).rejects.toThrow("resubmit=invalid");
    expect((await deleteOwnedBusinessAction({ id: business.id, confirmed: true })).success).toBe(false);
    expect((await deleteOwnedEventAction({ id: event.id, confirmed: true })).success).toBe(false);
    expect(await publicBusiness()).not.toBeNull();
    expect(await publicEvent()).not.toBeNull();
  });

  it.each(["ACTIVE", "PAST_DUE", "CANCELED"])("allows owner removal with %s access and idempotent audit history", async (billingStatus) => {
    await db.user.update({ where: { id: owner.id }, data: { billingStatus } });
    expect((await deleteOwnedBusinessAction({ id: business.id, confirmed: true })).success).toBe(true);
    const deleted = await db.business.findUnique({ where: { id: business.id } });
    await deleteOwnedBusinessAction({ id: business.id, confirmed: true });
    expect((await db.business.findUnique({ where: { id: business.id } })).deletedAt).toEqual(deleted.deletedAt);
    expect(await db.auditLog.count({ where: { entityId: business.id, action: "OWNER_DELETE" } })).toBe(1);
    expect(await publicBusiness()).toBeNull();
    expect(await publicEvent()).toBeNull();
    expect(await db.event.findFirst({ where: { id: event.id, ...getOwnedEventWhere(owner.id) } })).not.toBeNull();
    await deleteOwnedEventAction({ id: event.id, confirmed: true });
    await deleteOwnedEventAction({ id: event.id, confirmed: true });
    expect(await db.auditLog.count({ where: { entityId: event.id, action: "OWNER_DELETE" } })).toBe(1);
    expect(await db.event.findFirst({ where: { id: event.id, ...getOwnedEventWhere(owner.id) } })).toBeNull();
    expect((await db.user.findUnique({ where: { id: owner.id } })).stripeSubscriptionId).toBe(owner.stripeSubscriptionId);
  });

  it("blocks inactive edits and publication while retaining deletion", async () => {
    await db.user.update({ where: { id: owner.id }, data: { billingStatus: "PAST_DUE" } });
    expect((await updateBusinessAction(business.id, businessInput())).success).toBe(false);
    expect((await publishBusinessAction(business.id)).success).toBe(false);
    expect((await updateEventAction(null, eventInput())).error).toContain("membership");
    expect((await deleteOwnedEventAction({ id: event.id, confirmed: true })).success).toBe(true);
  });

  it("backfills category relations while preserving explicit choices, inferred legacy labels, tags and event status", async () => {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Event" ("id" TEXT PRIMARY KEY, "title" TEXT, "description" TEXT, "status" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Tag" ("id" TEXT PRIMARY KEY, "name" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "_EventToTag" ("A" TEXT, "B" TEXT) ON COMMIT DROP');
      await tx.$executeRawUnsafe(`INSERT INTO "Event" VALUES ('explicit','Music Market','Title must not override the chosen category','PUBLISHED'), ('music','Live concert','Local band','DRAFT'), ('market','Saturday market','Local vendors','PUBLISHED'), ('custom','Weekly meetup','An afternoon together','CANCELLED'), ('community','A gathering','Neighbors meeting','DENIED')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Tag" VALUES ('explicit','Event Category: Arts & Culture'), ('custom','Chess Club')`);
      await tx.$executeRawUnsafe(`INSERT INTO "_EventToTag" VALUES ('explicit','explicit'), ('custom','custom')`);
      const sql = readFileSync(new URL("../../prisma/migrations/20260929000000_separate_event_categories/migration.sql", import.meta.url), "utf8")
        .replace(/^BEGIN;|^COMMIT;/gm, "")
        .replace('CREATE TABLE "EventCategory"', 'CREATE TEMP TABLE "EventCategory"')
        .replace('CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")\n);', 'CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")\n) ON COMMIT DROP;');
      for (const statement of sql.replace(/^--.*$/gm, "").split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
      const rows = await tx.$queryRawUnsafe('SELECT e."id", e."status", c."name" FROM "Event" e JOIN "EventCategory" c ON c."id"=e."categoryId" ORDER BY e."id"');
      expect(rows).toEqual([
        { id: "community", status: "DENIED", name: "Community" },
        { id: "custom", status: "CANCELLED", name: "Chess Club" },
        { id: "explicit", status: "PUBLISHED", name: "Arts & Culture" },
        { id: "market", status: "PUBLISHED", name: "Markets" },
        { id: "music", status: "DRAFT", name: "Live Music" },
      ]);
      expect((await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "_EventToTag"'))[0].count).toBe(2);
    });
  });

  it("keeps the business and event category lists separate, including identical names", async () => {
    const businessCategory = await addManagedCategory("business");
    const eventCategory = await addManagedCategory("event", businessCategory.name);
    expect(eventCategory.id).not.toBe(businessCategory.id);
    expect(await getEventCategoryOptions()).toEqual(expect.arrayContaining([expect.objectContaining({ id: eventCategory.id })]));
    expect((await getEventCategoryOptions()).some((item) => item.id === businessCategory.id)).toBe(false);
    expect(await db.category.findUnique({ where: { id: eventCategory.id } })).toBeNull();
    harness.userId = owner.id;
    const created = await createBusinessFromFormAction({ ...businessInput(), categoryIds: [businessCategory.id] });
    expect(created.success).toBe(true);
    expect(await db.businessCategory.findFirst({ where: { businessId: created.data.id } })).toMatchObject({ categoryId: businessCategory.id });
    const wrong = await createBusinessFromFormAction({ ...businessInput(), categoryIds: [eventCategory.id] });
    expect(wrong.success).toBe(false);
    const input = eventInput();
    input.set("categoryId", eventCategory.id);
    input.delete("category");
    input.set("businessId", business.id);
    await expect(createEventAction(null, input)).rejects.toThrow("created=1");
    expect(await db.event.findFirst({ where: { creatorId: owner.id, categoryId: eventCategory.id } })).not.toBeNull();
    input.set("categoryId", businessCategory.id);
    expect((await createEventAction(null, input)).fieldErrors.category).toContain("available event category");
  });

  it("renames categories in existing listings, public filters, details and APIs without changing their associations", async () => {
    const businessCategory = await addManagedCategory("business");
    const eventCategory = await addManagedCategory("event", businessCategory.name);
    await db.businessCategory.create({ data: { businessId: business.id, categoryId: businessCategory.id } });
    await db.event.update({ where: { id: event.id }, data: { categoryId: eventCategory.id } });
    const renamed = `${businessCategory.name} Updated`;
    expect((await renameCategoryAction(null, form({ type: "business", categoryId: businessCategory.id, expectedName: businessCategory.name, name: renamed }))).error).toBe("");
    expect(await db.category.findUnique({ where: { id: businessCategory.id } })).toMatchObject({ name: renamed, slug: businessCategory.slug });
    expect(await db.eventCategory.findUnique({ where: { id: eventCategory.id } })).toMatchObject({ name: eventCategory.name });
    const businessResult = await searchBusinesses({ nextUrl: new URL(`http://localhost/api/search?category=${businessCategory.slug}`) });
    expect((await businessResult.json()).data.results.find((item) => item.id === business.id).categories).toEqual(expect.arrayContaining([expect.objectContaining({ name: renamed })]));
    expect((await renameCategoryAction(null, form({ type: "event", categoryId: eventCategory.id, expectedName: eventCategory.name, name: renamed }))).error).toBe("");
    expect(await getEventById(event.id)).toMatchObject({ type: renamed, categoryTags: [{ id: eventCategory.id, name: renamed, slug: eventCategory.slug }] });
    const page = await getEventsPageData({ category: renamed });
    expect(page.filteredEvents.some((item) => item.id === event.id)).toBe(true);
    expect(page.categories).toContain(renamed);
    expect(page.categories).not.toContain(eventCategory.name);
    const renamedEvent = page.filteredEvents.find((item) => item.id === event.id);
    expect(filterEvents([{ ...renamedEvent, tags: [eventCategory.name] }], { category: eventCategory.name })).toEqual([]);
    const eventsResponse = await searchEvents(new Request(`http://localhost/api/events?city=${encodeURIComponent(city.name)}&q=Original`));
    expect((await eventsResponse.json()).events.find((item) => item.id === event.id).category.name).toBe(renamed);
    // An event form opened before the rename continues to save the same id.
    const input = eventInput();
    input.set("categoryId", eventCategory.id);
    await expect(updateEventAction(null, input)).rejects.toThrow("updated=1");
    expect(await db.event.findUnique({ where: { id: event.id } })).toMatchObject({ categoryId: eventCategory.id });
  });

  it("includes unused event categories in discovery filters", async () => {
    const category = await addManagedCategory("event");
    expect((await getEventsPageData()).categories).toContain(category.name);
    expect(await db.event.count({ where: { categoryId: category.id } })).toBe(0);
  });

  it("protects category management from non-admins, duplicates, cross-type ids and stale forms", async () => {
    const category = await addManagedCategory("business");
    const another = await addManagedCategory("business");
    const edit = { type: "business", categoryId: category.id, expectedName: category.name, name: `${category.name} New` };
    expect((await createCategoryAction(null, form({ type: "business", name: category.name.toLowerCase() }))).error).toContain("already exists");
    expect((await renameCategoryAction(null, form({ ...edit, name: another.name }))).error).toContain("already exists");
    expect((await renameCategoryAction(null, form({ ...edit, type: "event" }))).error).toContain("not found");
    expect((await renameCategoryAction(null, form({ ...edit, expectedName: "Old name" }))).error).toContain("changed");
    expect((await createCategoryAction(null, form({ type: "__proto__", name: "Other" }))).error).toContain("Choose business or event");
    harness.userId = owner.id;
    await expect(createCategoryAction(null, form({ type: "event", name: "New event category" }))).rejects.toThrow("FORBIDDEN");
    await expect(renameCategoryAction(null, form(edit))).rejects.toThrow("FORBIDDEN");
    expect(await db.category.findUnique({ where: { id: category.id } })).toMatchObject({ name: category.name });
  });

  it("rolls back a category rename when its audit record cannot be written", async () => {
    const category = await addManagedCategory("event");
    const transaction = db.$transaction.bind(db);
    vi.spyOn(db, "$transaction").mockImplementationOnce((work, options) => transaction(async (tx) => {
      tx.auditLog.create = async () => { throw new Error("Simulated audit failure"); };
      return work(tx);
    }, options));
    expect((await renameCategoryAction(null, form({ type: "event", categoryId: category.id, expectedName: category.name, name: `${category.name} Renamed` }))).error).toContain("could not be saved");
    expect(await db.eventCategory.findUnique({ where: { id: category.id } })).toMatchObject({ name: category.name });
  });

  it("rejects simultaneous duplicate category creation in the same list", async () => {
    harness.userId = admin.id;
    const name = `Parallel Category ${id().replaceAll("_", " ")}`;
    const results = await Promise.all([name, name.toLowerCase()].map((value) => createCategoryAction(null, form({ type: "event", name: value }))));
    const created = await db.eventCategory.findFirstOrThrow({ where: { name: { equals: name, mode: "insensitive" } } });
    managedCategoryIds.event.push(created.id);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.error?.includes("already exists"))).toHaveLength(1);
  });

  it("makes an empty admin city selectable and accepts it in business and event creation", async () => {
    const target = await addManagedCity();
    expect(await getSelectableCities()).toEqual(expect.arrayContaining([expect.objectContaining({ id: target.id })]));
    harness.userId = owner.id;
    const result = await createBusinessFromFormAction({ ...businessInput(), name: "New City Market", cityId: target.id, address: "456 Main Street", zipCode: "78701" });
    expect(result.success).toBe(true);
    expect(await db.business.findUnique({ where: { id: result.data.id }, include: { city: true } })).toMatchObject({ city: { name: target.name } });
    const input = eventInput();
    input.set("cityId", target.id);
    input.delete("city");
    input.set("businessId", business.id);
    await expect(createEventAction(null, input)).rejects.toThrow("created=1");
    expect(await db.event.findFirst({ where: { creatorId: owner.id, city: target.name } })).toMatchObject({ state: "TX", country: "US" });
  });

  it("renames businesses and matching Texas events while preserving ids, slugs and out-of-state locations", async () => {
    const target = await addManagedCity();
    await db.business.update({ where: { id: business.id }, data: { cityId: target.id } });
    await db.event.update({ where: { id: event.id }, data: { city: target.name.toLowerCase(), state: "Texas", country: "USA" } });
    const outside = await db.event.create({ data: { title: "Outside Texas", description: "Different city with same name", imageUrl: "", addressName: "Hall", address: "123 Main St", zipCode: "12345", city: target.name, state: "CA", creatorId: owner.id } });
    const renamed = `${target.name} Heights`;
    expect((await renameCityAction(null, cityInput(target, { name: renamed }))).error).toBe("");
    expect(await db.city.findUnique({ where: { id: target.id } })).toMatchObject({ name: renamed, slug: target.slug });
    expect(await db.business.findUnique({ where: { id: business.id }, include: { city: true } })).toMatchObject({ cityId: target.id, slug: business.slug, city: { name: renamed } });
    expect(await db.event.findUnique({ where: { id: event.id } })).toMatchObject({ city: renamed, status: "PUBLISHED" });
    expect(await db.event.findUnique({ where: { id: outside.id } })).toMatchObject({ city: target.name });
    // A form opened before the rename submits the stable id and stores the current name.
    const input = eventInput();
    input.set("cityId", target.id);
    input.set("city", target.name);
    await expect(createEventAction(null, input)).rejects.toThrow("created=1");
    expect(await db.event.findFirst({ where: { creatorId: admin.id, city: renamed } })).not.toBeNull();
  });

  it("moves every business and matching event to the fallback without changing billing or publication", async () => {
    const target = await addManagedCity();
    await db.business.update({ where: { id: business.id }, data: { cityId: target.id } });
    await db.event.update({ where: { id: event.id }, data: { city: target.name } });
    const archived = await db.business.create({ data: { name: "Archived shop", slug: id(), description: "Archived shop in the city", address: "123 Main St", zipCode: "78701", cityId: target.id, ownerId: owner.id, status: "ARCHIVED", deletedAt: new Date() } });
    const subscription = await db.subscription.create({ data: { businessId: business.id, planId: starter.id, status: "ACTIVE" } });
    const payment = await db.eventPayment.create({ data: { eventId: event.id, userId: owner.id, status: "PAID", stripePriceId: "price_test", amountCents: 1000 } });
    expect((await deleteCityAction(null, cityInput(target, { confirmed: "yes" }))).success).toContain("2 businesses, 0 other businesses, and 1 events");
    const fallback = await db.city.findUniqueOrThrow({ where: { slug: "uncategorized" } });
    expect(await db.city.findUnique({ where: { id: target.id } })).toBeNull();
    expect(await db.business.findUnique({ where: { id: business.id } })).toMatchObject({ cityId: fallback.id, status: "ACTIVE", publishedAt: business.publishedAt });
    expect(await db.business.findUnique({ where: { id: archived.id } })).toMatchObject({ cityId: fallback.id, deletedAt: archived.deletedAt, status: "ARCHIVED" });
    expect(await db.event.findUnique({ where: { id: event.id } })).toMatchObject({ city: "Uncategorized", status: "PUBLISHED" });
    expect(await db.subscription.findUnique({ where: { id: subscription.id } })).toEqual(subscription);
    expect(await db.eventPayment.findUnique({ where: { id: payment.id } })).toEqual(payment);
    expect((await getSelectableCities()).some((row) => row.id === fallback.id)).toBe(false);
    expect((await getSelectableCities(fallback.id)).some((row) => row.id === fallback.id)).toBe(true);
    expect((await renameCityAction(null, cityInput(fallback, { name: "Other" }))).error).toContain("protected");
    expect((await deleteCityAction(null, cityInput(fallback, { confirmed: "yes" }))).error).toContain("protected");
    expect((await createCityAction(null, form({ name: "Uncategorized" }))).error).toContain("reserved");
    const input = eventInput();
    input.set("cityId", target.id);
    expect((await createEventAction(null, input)).fieldErrors.city).toContain("no longer available");
    input.set("cityId", fallback.id);
    expect((await createEventAction(null, input)).fieldErrors.city).toContain("no longer available");
    // Owners can still edit an event moved to Uncategorized and reassign it later.
    input.set("cityId", "legacy");
    input.set("city", "Uncategorized");
    await expect(updateEventAction(null, input)).rejects.toThrow("updated=1");
  });

  it("rejects unauthorized, duplicate, unconfirmed and stale city mutations", async () => {
    const target = await addManagedCity();
    const duplicate = await addManagedCity();
    expect((await renameCityAction(null, cityInput(target, { name: duplicate.name.toLowerCase() }))).error).toContain("already exists");
    expect((await deleteCityAction(null, cityInput(target))).error).toContain("Confirm");
    expect((await renameCityAction(null, cityInput(target, { expectedName: "Stale City", name: "New City" }))).error).toContain("changed");
    expect((await deleteCityAction(null, cityInput(target, { expectedName: "Stale City", confirmed: "yes" }))).error).toContain("changed");
    harness.userId = owner.id;
    await expect(renameCityAction(null, cityInput(target, { name: "New City" }))).rejects.toThrow("FORBIDDEN");
    await expect(deleteCityAction(null, cityInput(target, { confirmed: "yes" }))).rejects.toThrow("FORBIDDEN");
    expect(await db.city.findUnique({ where: { id: target.id } })).toMatchObject({ name: target.name });
  });

  it("rolls back reassignment and deletion if the audit write fails", async () => {
    const target = await addManagedCity();
    await db.business.update({ where: { id: business.id }, data: { cityId: target.id } });
    await db.event.update({ where: { id: event.id }, data: { city: target.name } });
    const transaction = db.$transaction.bind(db);
    vi.spyOn(db, "$transaction").mockImplementationOnce((work, options) => transaction(async (tx) => {
      tx.auditLog.create = async () => { throw new Error("Simulated audit failure"); };
      return work(tx);
    }, options));
    expect((await deleteCityAction(null, cityInput(target, { confirmed: "yes" }))).error).toContain("could not be deleted");
    expect(await db.city.findUnique({ where: { id: target.id } })).not.toBeNull();
    expect(await db.business.findUnique({ where: { id: business.id } })).toMatchObject({ cityId: target.id });
    expect(await db.event.findUnique({ where: { id: event.id } })).toMatchObject({ city: target.name });
  });

  it("serializes competing city renames and rejects the stale edit", async () => {
    const target = await addManagedCity();
    const results = await Promise.all(["Heights", "Hills"].map((suffix) => renameCityAction(null, cityInput(target, { name: `${target.name} ${suffix}` }))));
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => result.error?.includes("changed"))).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: target.id, action: "update" } })).toBe(1);
  });

  it.each(["rename", "delete"])("includes an event saved while the city %s waits for its row lock", async (operation) => {
    const target = await addManagedCity();
    const { promise: eventLocked, resolve: signalEventLocked } = Promise.withResolvers();
    const { promise: finishEvent, resolve: releaseEvent } = Promise.withResolvers();
    const { promise: adminWaiting, resolve: signalAdminWaiting } = Promise.withResolvers();
    const saving = db.$transaction(async (tx) => {
      const location = await resolveEventCity(tx, { cityId: target.id });
      signalEventLocked();
      await finishEvent;
      return tx.event.create({ data: { ...location, title: "Concurrent save", description: "A new event saved during a city update", imageUrl: "", addressName: "Hall", address: "123 Main St", zipCode: "78701", creatorId: owner.id } });
    });
    await eventLocked;
    const transaction = db.$transaction.bind(db);
    vi.spyOn(db, "$transaction").mockImplementationOnce((work, options) => transaction((tx) => work(new Proxy(tx, {
      get(client, property) {
        if (property !== "$queryRaw") return client[property];
        return (...args) => {
          if (args[0].join("").includes("FOR UPDATE")) signalAdminWaiting();
          return client.$queryRaw(...args);
        };
      },
    })), options));
    const updating = operation === "rename"
      ? renameCityAction(null, cityInput(target, { name: `${target.name} Heights` }))
      : deleteCityAction(null, cityInput(target, { confirmed: "yes" }));
    try {
      await adminWaiting;
    } finally {
      releaseEvent();
    }
    const saved = await saving;
    expect((await updating).error).toBe("");
    expect(await db.event.findUnique({ where: { id: saved.id } })).toMatchObject({ city: operation === "rename" ? `${target.name} Heights` : "Uncategorized" });
  });

  it("creates a weekly membership series, reviews it, edits it after its first week, and stops repeating", async () => {
    const input = eventInput();
    input.set("businessId", business.id);
    input.set("recurrence", "WEEKLY");
    await expect(createEventAction(null, input)).rejects.toThrow("created=1");
    const series = await db.event.findFirst({ where: { creatorId: owner.id, recurrence: "WEEKLY" } });
    expect(series).toMatchObject({ postingMethod: "SUBSCRIPTION", status: "PENDING" });
    // The first occurrence has passed, but the series is still valid for review.
    await db.event.update({ where: { id: series.id }, data: { startDate: new Date("2026-01-02T01:00:00Z"), endDate: new Date("2026-01-02T03:00:00Z") } });
    await approveEventForPublication({ eventId: series.id, reviewerId: admin.id });
    const detail = await getEventById(series.id);
    expect(detail.recurrenceLabel).toBe("Every Thursday");
    expect(new Date(detail.endDate) >= new Date()).toBe(true);
    expect(detail.occurrences).toHaveLength(54);
    expect(new Set(detail.dateKeys).size).toBe(detail.dateKeys.length);
    const laterOccurrence = detail.occurrences[3];
    expect((await getEventById(series.id, laterOccurrence.dateKeys[0])).startDate).toBe(laterOccurrence.startDate);
    expect(await getEventById(series.id, "2030-02-30")).toBeNull();
    expect(await getEventById(series.id, "2030-01-11")).toBeNull(); // Friday, not Thursday

    input.set("eventId", series.id);
    input.set("startDate", "2026-01-01T19:00");
    input.set("endDate", "2026-01-01T21:00");
    await expect(updateEventAction(null, input)).rejects.toThrow("updated=1");
    expect((await db.event.findUnique({ where: { id: series.id } })).status).toBe("PENDING");

    input.set("recurrence", "NONE");
    input.set("startDate", "2030-01-10T19:00");
    input.set("endDate", "2030-01-10T21:00");
    await expect(updateEventAction(null, input)).rejects.toThrow("updated=1");
    expect(await db.event.findUnique({ where: { id: series.id } })).toMatchObject({ recurrence: "NONE", recurrenceUntil: null });
  });

  it.each(["PAST_DUE", "UNPAID", "CANCELED", "INCOMPLETE", "PAUSED"])("hides weekly events everywhere when membership is %s and restores on recovery", async (billingStatus) => {
    await db.event.update({ where: { id: event.id }, data: { recurrence: "WEEKLY", startDate: new Date("2026-01-02T01:00Z"), endDate: new Date("2026-01-02T03:00Z") } });
    expect(await db.event.findFirst({ where: { id: event.id, ...getPublicEventWhere() } })).not.toBeNull();
    await db.user.update({ where: { id: owner.id }, data: { billingStatus } });
    expect(await publicEvent()).toBeNull();
    expect(await getEventById(event.id)).toBeNull();
    expect((await getEventsPageData({ location: city.name })).allEvents.some((item) => item.id === event.id)).toBe(false);
    const response = await searchEvents(new Request(`http://localhost/api/events?city=${encodeURIComponent(city.name)}`));
    expect((await response.json()).events.some((item) => item.id === event.id)).toBe(false);
    expect((await db.event.findUnique({ where: { id: event.id } })).status).toBe("PUBLISHED");
    await db.user.update({ where: { id: owner.id }, data: { billingStatus: "ACTIVE" } });
    expect(await getEventById(event.id)).not.toBeNull();
  });

  it("removes weekly results at the paid cancellation boundary", async () => {
    await db.event.update({ where: { id: event.id }, data: { recurrence: "WEEKLY" } });
    await db.user.update({ where: { id: owner.id }, data: { cancelAtPeriodEnd: true, currentPeriodEnd: new Date(Date.now() + 86400000) } });
    expect(await publicEvent()).not.toBeNull();
    await db.user.update({ where: { id: owner.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    expect(await publicEvent()).toBeNull();
  });

  it("paginates next recurring dates alongside single events without duplicates or missing rows", async () => {
    const title = id();
    const recurring = await db.event.update({ where: { id: event.id }, data: { title, recurrence: "WEEKLY", startDate: new Date("2026-01-02T01:00Z"), endDate: new Date("2026-01-02T03:00Z") } });
    const next = getNextEventOccurrence(recurring);
    const expected = [event.id];
    for (let index = 1; index <= 6; index++) {
      const single = await db.event.create({ data: { title, creatorId: owner.id, businessId: business.id, imageUrl: "", description: "Pagination fixture", addressName: "Town Hall", address: "123 Main St", zipCode: "78701", city: city.name, state: "TX", status: "PUBLISHED", postingMethod: "SUBSCRIPTION", startDate: new Date(+next.startDate + index * 86400000), endDate: new Date(+next.endDate + index * 86400000) } });
      expected.push(single.id);
    }
    const actual = [];
    for (let page = 1; page <= 4; page++) {
      const response = await searchEvents(new Request(`http://localhost/api/events?q=${title}&sort=upcoming&limit=2&page=${page}`));
      const data = await response.json();
      expect(data.total).toBe(7);
      expect(data.hasMore).toBe(page < 4);
      actual.push(...data.events.map((item) => item.id));
    }
    expect(actual).toEqual(expected);
  });

  it("rejects recurring one-time purchases at the action and database boundaries", async () => {
    const input = eventInput();
    input.set("recurrence", "WEEKLY");
    expect((await createEventAction(null, input)).error).toContain("membership");
    await db.event.update({ where: { id: event.id }, data: { postingMethod: "ONE_TIME" } });
    expect((await updateEventAction(null, input)).error).toContain("One-time");
    await expect(db.event.update({ where: { id: event.id }, data: { recurrence: "WEEKLY" } })).rejects.toThrow();
  });

  it.each(["USER", "COMPLIMENTARY", "MANAGER", "ADMIN"])("allows entitled %s owner edits and legacy events without a business link", async (role) => {
    await db.user.update({ where: { id: owner.id }, data: { role, billingStatus: role === "USER" ? "ACTIVE" : "CANCELED" } });
    expect((await updateBusinessAction(business.id, businessInput())).success).toBe(true);
    await db.event.update({ where: { id: event.id }, data: { postingMethod: "LEGACY", businessId: null } });
    await expect(updateEventAction(null, eventInput())).rejects.toThrow("updated=1");
    expect((await db.event.findUnique({ where: { id: event.id } })).title).toBe("Updated event");
  });

  it("retains one-time event editing and public visibility without membership", async () => {
    await db.user.update({ where: { id: owner.id }, data: { billingStatus: "CANCELED" } });
    await db.event.update({ where: { id: event.id }, data: { postingMethod: "ONE_TIME" } });
    await db.eventPayment.create({ data: { eventId: event.id, userId: owner.id, status: "PAID", stripePriceId: "price_event_test", amountCents: 1000, currency: "usd", paidAt: new Date(), eventStartDate: event.startDate, eventEndDate: event.endDate } });
    expect(await publicEvent()).not.toBeNull();
    await expect(updateEventAction(null, eventInput())).rejects.toThrow("updated=1");
    expect((await deleteOwnedEventAction({ id: event.id, confirmed: true })).success).toBe(true);
    expect(await db.eventPayment.count({ where: { eventId: event.id, status: "PAID" } })).toBe(1);
  });

  it("rejects stale edits and admin restoration after deletion", async () => {
    // A deletion arriving after the edit's read must also be checked at the write.
    const read = db.business.findUnique.bind(db.business);
    const spy = vi.spyOn(db.business, "findUnique").mockImplementationOnce(async (args) => {
      const stale = await read(args);
      await deleteOwnedBusinessAction({ id: business.id, confirmed: true });
      return stale;
    });
    expect((await updateBusinessAction(business.id, businessInput())).success).toBe(false);
    spy.mockRestore();
    expect((await publishBusinessAction(business.id)).success).toBe(false);
    harness.userId = admin.id;
    await activateBusinessAction(form({ id: business.id }));
    await updatePostModerationStatusAction(form({ entityId: business.id, entityType: "business", status: "approved" }));
    expect(await publicBusiness()).toBeNull();
    expect((await db.business.findUnique({ where: { id: business.id } })).name).toBe("Original business");
    harness.userId = owner.id;
    await deleteOwnedEventAction({ id: event.id, confirmed: true });
    expect((await updateEventAction(null, eventInput())).error).toBe("Event not found.");
  });

  it("applies failed payment, recovery and period-end cancellation without overriding moderation or deletion", async () => {
    const subscription = { id: owner.stripeSubscriptionId, customer: id(), status: "past_due", metadata: { ownerId: owner.id, scope: "account" }, cancel_at_period_end: false, items: { data: [{ current_period_end: Math.floor(Date.now()/1000) + 86400, price: { id: starter.stripePriceId, active: true, currency: "usd", unit_amount: 1000, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, product: "prod_test" } }] } };
    expect(await syncStripeSubscriptionObject(subscription)).toBe(true);
    expect((await getAccountAccess(owner.id)).hasCreatorAccess).toBe(false);
    expect(await publicBusiness()).toBeNull();
    expect(await publicEvent()).toBeNull();
    subscription.status = "active";
    await syncStripeSubscriptionObject(subscription);
    expect(await publicBusiness()).not.toBeNull();
    expect(await publicEvent()).not.toBeNull();
    await db.business.update({ where: { id: business.id }, data: { status: "SUSPENDED" } });
    await db.event.update({ where: { id: event.id }, data: { status: "PENDING" } });
    await syncStripeSubscriptionObject(subscription);
    expect(await publicBusiness()).toBeNull();
    expect(await publicEvent()).toBeNull();
    await db.business.update({ where: { id: business.id }, data: { status: "ACTIVE" } });
    subscription.cancel_at_period_end = true;
    await syncStripeSubscriptionObject(subscription);
    expect(await publicBusiness()).not.toBeNull();
    subscription.items.data[0].current_period_end = Math.floor(Date.now()/1000) - 1;
    await syncStripeSubscriptionObject(subscription);
    expect(await publicBusiness()).toBeNull();
    expect((await getAccountAccess(owner.id)).hasCreatorAccess).toBe(false);
    await deleteOwnedBusinessAction({ id: business.id, confirmed: true });
    subscription.cancel_at_period_end = false;
    await syncStripeSubscriptionObject(subscription);
    expect(await publicBusiness()).toBeNull();
  });

  it("creates an admin city, rejects duplicates and propagates a city without listings", async () => {
    const name = `Test Empty ${String(Date.now()).replace(/\d/g, (n) => String.fromCharCode(65 + Number(n)))}`;
    await expect(createCityAction(null, form({ name }))).rejects.toThrow("FORBIDDEN");
    harness.userId = admin.id;
    expect((await createCityAction(null, form({ name: `  ${name}  ` }))).success).toContain(name);
    expect((await createCityAction(null, form({ name: name.toUpperCase() }))).error).toContain("already exists");
    expect((await createCityAction(null, form({ name: name.replaceAll(" ", "-") }))).error).toContain("already exists");
    const created = await db.city.findFirst({ where: { name } });
    expect(created.state).toBe("Texas");
    expect(await db.business.count({ where: { cityId: created.id } })).toBe(0);
    expect((await getEventsPageData()).cities).toContain(`${name}, TX`);
    // This is the same unfiltered city table used by new/edit business dropdowns.
    expect((await db.city.findMany({ select: { id: true } })).map((row) => row.id)).toContain(created.id);
  });

  it.each(["newest", "oldest", "name-asc", "name-desc", "popular"])("sorts mixed-case businesses globally before filtered pagination: %s", async (sort) => {
    const names = ["zebra", "Alpha", "beta", "alpha", "Delta"];
    const rows = await Promise.all(names.map((name, index) => db.business.create({ data: { ...business, id: id(), sortName: undefined, slug: id(), name, createdAt: new Date(1800000000000 + (index % 3)*1000) } })));
    await db.business.update({ where: { id: business.id }, data: { status: "PAUSED" } });
    const expected = [...rows].sort((a,b) => {
      let result = sort.startsWith("name-") ? (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0) : Number(a.createdAt) - Number(b.createdAt);
      if (["name-desc", "newest", "popular"].includes(sort)) result *= -1;
      return result || a.id.localeCompare(b.id);
    }).map((row) => row.id);
    const found = [];
    for (let page = 1; page <= 3; page++) {
      const url = new URL(`http://localhost/api/search?sort=${sort}&limit=2&page=${page}&loc=${encodeURIComponent(city.name)}&q=${""}`);
      // Other test rows share the city: narrow the actual API with a unique description.
      await db.business.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { description: owner.id } });
      url.searchParams.set("q", owner.id);
      const response = await searchBusinesses({ nextUrl: url });
      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.data.total).toBe(5);
      expect(payload.data.hasMore).toBe(page < 3);
      found.push(...payload.data.results.map((row) => row.id));
    }
    expect(found).toEqual(expected);
    expect(new Set(found).size).toBe(5);
  });

  it.each(["newest", "oldest", "name-asc", "name-desc", "upcoming"])("sorts event results before pagination: %s", async (sort) => {
    const rows = await Promise.all(["zebra", "Alpha", "alpha"].map((title, index) => db.event.create({ data: { ...event, id: id(), sortName: undefined, title, description: owner.id, createdAt: new Date(1800000000000 + (index % 2)*1000) } })));
    const expected = await db.event.findMany({ where: { id: { in: rows.map((row) => row.id) } }, orderBy: resultOrderBy(sort, { name: "sortName", extras: ["upcoming"] }) });
    const found = [];
    for (let page = 1; page <= 3; page++) {
      const response = await searchEvents(new Request(`http://localhost/api/events?sort=${sort}&limit=1&page=${page}&q=${owner.id}`));
      const payload = await response.json();
      expect(payload.total).toBe(3);
      found.push(...payload.events.map((row) => row.id));
    }
    expect(found).toEqual(expected.map((row) => row.id));
  });
});
