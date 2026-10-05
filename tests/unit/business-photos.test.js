import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  access: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findBusiness: vi.fn(),
  findSlug: vi.fn(),
  findCity: vi.fn(),
  transaction: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user, getCurrentUser: mocks.user }));
vi.mock("@/lib/account-access", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  business: { findUnique: mocks.findBusiness, findFirst: mocks.findSlug },
  city: { findUnique: mocks.findCity },
  $transaction: mocks.transaction,
} }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/email", () => ({ sendNewApplicationEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createBusinessFromFormAction, updateBusinessAction } from "@/app/actions/businesses";
import { POST } from "@/app/api/business-photos/upload/route";

const photos = Array.from({ length: 3 }, (_, index) => ({
  url: `https://example.com/business-${index}.jpg`, name: `Business photo ${index}`,
}));
const input = {
  name: "Town Cafe", description: "A neighborhood cafe serving the local community.",
  cityId: "austin", photos,
};

beforeEach(() => {
  mocks.user.mockResolvedValue({ id: "owner", role: "USER" });
  mocks.access.mockResolvedValue({ hasCreatorAccess: true, activePlanId: "starter" });
  mocks.findCity.mockResolvedValue({ id: "austin", name: "Austin", slug: "austin" });
  mocks.findBusiness.mockResolvedValue({ ownerId: "owner", slug: "town-cafe", status: "ACTIVE", deletedAt: null });
  mocks.findSlug.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "business" });
  mocks.update.mockResolvedValue({ id: "business" });
  mocks.transaction.mockImplementation((run) => run({ business: { create: mocks.create, update: mocks.update } }));
  mocks.put.mockImplementation(async (path) => ({ url: `https://example.com/${path}`, pathname: path }));
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
});

afterEach(() => vi.unstubAllEnvs());

describe("business photo allowance", () => {
  it.each(["USER", "COMPLIMENTARY"])("saves three ordered photos for a %s account with creator access", async (role) => {
    mocks.user.mockResolvedValue({ id: "owner", role });
    expect(await createBusinessFromFormAction(input)).toMatchObject({ success: true });
    expect(mocks.create.mock.calls[0][0].data.photos.create).toEqual(
      photos.map((photo, order) => ({ url: photo.url, alt: photo.name, order })),
    );
  });

  it.each(["create", "update"])("rejects a fourth photo before %s persistence", async (mode) => {
    const data = { ...input, photos: [...photos, { url: "https://example.com/fourth.jpg" }] };
    const result = mode === "create" ? await createBusinessFromFormAction(data) : await updateBusinessAction("business", data);
    expect(result).toEqual({ success: false, message: "Upload up to 3 business photos." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("replaces the photo selection in order when editing", async () => {
    expect(await updateBusinessAction("business", input)).toMatchObject({ success: true });
    expect(mocks.update.mock.calls[0][0].data.photos).toEqual({
      deleteMany: {}, create: photos.map((photo, order) => ({ url: photo.url, alt: photo.name, order })),
    });
  });

  it("removes all photos when the owner clears the selection", async () => {
    expect(await updateBusinessAction("business", { ...input, photos: [] })).toMatchObject({ success: true });
    expect(mocks.update.mock.calls[0][0].data.photos).toEqual({ deleteMany: {}, create: [] });
  });

  it("preserves stored photos when an edit does not include photo changes", async () => {
    const { photos: unusedPhotos, ...data } = input;
    expect(await updateBusinessAction("business", data)).toMatchObject({ success: true });
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("photos");
  });

  it("rejects malformed photo input and non-image URL protocols", async () => {
    for (const invalidPhotos of [null, {}, [{ url: "javascript:alert(1)" }]]) {
      expect(await updateBusinessAction("business", { ...input, photos: invalidPhotos })).toMatchObject({ success: false });
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("retains ownership checks before editing photos", async () => {
    mocks.findBusiness.mockResolvedValue({ ownerId: "someone-else", slug: "town-cafe", status: "ACTIVE" });
    expect(await updateBusinessAction("business", input)).toMatchObject({ success: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

function uploadRequest(count) {
  const body = new FormData();
  for (let index = 0; index < count; index++) {
    body.append("files", new File(["photo"], `photo-${index}.jpg`, { type: "image/jpeg" }));
  }
  return new Request("http://localhost/api/business-photos/upload", { method: "POST", body });
}

describe("business photo upload", () => {
  it.each(["USER", "COMPLIMENTARY"])("accepts three images for a %s account with creator access", async (role) => {
    mocks.user.mockResolvedValue({ id: "owner", role });
    const response = await POST(uploadRequest(3));
    expect(response.status).toBe(200);
    expect((await response.json()).files).toHaveLength(3);
    expect(mocks.put).toHaveBeenCalledTimes(3);
  });

  it("rejects four images before uploading any files", async () => {
    const response = await POST(uploadRequest(4));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, message: "You can upload up to 3 business photos." });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("continues to require creator access", async () => {
    mocks.access.mockResolvedValue({ hasCreatorAccess: false });
    const response = await POST(uploadRequest(3));
    expect(response.status).toBe(403);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
