import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), create: vi.fn(), update: vi.fn(), findBusiness: vi.fn(), findSlug: vi.fn(), findCity: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/account-access", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { business: { findUnique: mocks.findBusiness, findFirst: mocks.findSlug, create: mocks.create }, city: { findUnique: mocks.findCity }, $transaction: mocks.transaction } }));
vi.mock("@/lib/email", () => ({ sendNewApplicationEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { createBusinessAction, createBusinessFromFormAction, updateBusinessAction } from "@/app/actions/businesses";

const offer = { headline: "Free coffee", description: "With any breakfast.", instructions: "Show this coupon.", enabled: true };
const input = { name: "Town Cafe", description: "A neighborhood cafe serving the local community.", cityId: "austin", offers: [offer] };
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: "owner", role: "USER" });
  mocks.access.mockResolvedValue({ hasCreatorAccess: true, activePlanId: "starter" });
  mocks.findCity.mockResolvedValue({ id: "austin", name: "Austin", slug: "austin" });
  mocks.findBusiness.mockResolvedValue({ ownerId: "owner", slug: "town-cafe", status: "ACTIVE", deletedAt: null });
  mocks.findSlug.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "business" });
  mocks.update.mockResolvedValue({ id: "business" });
  mocks.transaction.mockImplementation((run) => run({ business: { create: mocks.create, update: mocks.update } }));
});
describe("offer mutations", () => {
  it("supports serialized offers in the legacy FormData action", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...input, offers: JSON.stringify([offer]), address: "123 Main St", addressName: "Town Cafe", zipCode: "78701" })) form.set(key, value);
    await createBusinessAction(null, form);
    expect(mocks.create.mock.lastCall[0].data.offers.create).toMatchObject([{ headline: "Free coffee" }]);
    form.set("offers", "not-json");
    expect((await createBusinessAction(null, form)).fieldErrors.offers).toContain("valid list");
  });
  it.each(["USER", "COMPLIMENTARY"])("creates three ordered offers for entitled %s owners", async (role) => {
    mocks.user.mockResolvedValue({ id: "owner", role });
    expect((await createBusinessFromFormAction({ ...input, offers: [offer, offer, offer] })).success).toBe(true);
    expect(mocks.create.mock.calls[0][0].data.offers.create.map((item) => item.order)).toEqual([0, 1, 2]);
    expect(mocks.create.mock.calls[0][0].data.status).toBe("DRAFT");
  });
  it("updates, pauses, preserves omitted offers and removes an empty selection", async () => {
    expect((await updateBusinessAction("business", { ...input, offers: [{ ...offer, enabled: false }] })).success).toBe(true);
    expect(mocks.update.mock.lastCall[0].data.offers).toMatchObject({ deleteMany: {}, create: [{ enabled: false }] });
    const { offers, ...withoutOffers } = input;
    await updateBusinessAction("business", withoutOffers);
    expect(mocks.update.mock.lastCall[0].data).not.toHaveProperty("offers");
    await updateBusinessAction("business", { ...input, offers: [] });
    expect(mocks.update.mock.lastCall[0].data.offers).toEqual({ deleteMany: {}, create: [] });
  });
  it.each(["create", "update"])("rejects four offers and invalid content before %s writes", async (mode) => {
    const run = (data) => mode === "create" ? createBusinessFromFormAction(data) : updateBusinessAction("business", data);
    expect((await run({ ...input, offers: Array(4).fill(offer) })).success).toBe(false);
    expect((await run({ ...input, offers: [{ ...offer, instructions: "" }] })).success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires owner or admin permission and active creator access", async () => {
    mocks.findBusiness.mockResolvedValue({ ownerId: "another-owner", slug: "town-cafe", status: "ACTIVE" });
    expect((await updateBusinessAction("business", input)).success).toBe(false);
    mocks.user.mockResolvedValue({ id: "owner", role: "ADMIN" });
    expect((await updateBusinessAction("business", input)).success).toBe(true);
    mocks.access.mockResolvedValue({ hasCreatorAccess: false });
    expect((await createBusinessFromFormAction(input)).success).toBe(false);
    expect((await updateBusinessAction("business", input)).success).toBe(false);
  });
});
