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
import { publishBusinessAction, updateBusinessAction } from "@/app/actions/businesses";
import { createEventAction, updateEventAction, resubmitEventAction } from "@/app/actions/events";
import { approveEventForPublication } from "@/lib/event-payments";
import { getNextEventOccurrence } from "@/lib/event-recurrence";
import { getPublicEventWhere } from "@/lib/event-dates";
import { activateBusinessAction, updatePostModerationStatusAction } from "@/app/actions/admin";
import { createCityAction } from "@/app/actions/cities";
import { getAccountAccess } from "@/lib/account-access";
import { syncStripeSubscriptionObject } from "@/lib/billing";
import { getPublicBusinessWhere, getPublicEventAccessWhere, getOwnedEventWhere } from "@/lib/listing-visibility";
import { resultOrderBy } from "@/lib/results-sort";
import { getEventsPageData, getEventById } from "@/lib/events";
import { GET as searchBusinesses } from "@/app/api/search/route";
import { GET as searchEvents } from "@/app/api/events/route";

const db = harness.db;
const prefix = `listing_${Date.now()}_`;
let sequence = 0;
const id = () => `${prefix}${++sequence}`;
let owner, other, admin, city, business, event, starter;
const form = (values) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };
const publicBusiness = () => db.business.findFirst({ where: { id: business.id, ...getPublicBusinessWhere() } });
const publicEvent = () => db.event.findFirst({ where: { id: event.id, ...getPublicEventAccessWhere() } });
const businessInput = () => ({ name: "Updated business", description: "A local shop with useful items for the whole family.", cityId: city.id });
const eventInput = () => form({ eventId: event.id, title: "Updated event", description: "A gathering of neighbors with music and local food.", category: "Community", address: "123 Main St", zipCode: "78701", city: city.name, startDate: "2030-01-10T10:00", endDate: "2030-01-10T11:00", timezone: "America/Chicago" });

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
    await db.city.deleteMany({ where: { OR: [{ id: city.id }, { slug: { startsWith: "test-empty-" } }] } });
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
