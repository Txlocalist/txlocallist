import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "owner", role: "USER" },
  event: vi.fn(),
  business: vi.fn(),
  upload: vi.fn(),
  access: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  replaceImage: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => mocks.user }));
vi.mock("@/lib/account-access", () => ({
  getAccountAccess: mocks.access,
  isStaffRole: (role) => ["ADMIN", "MANAGER"].includes(role),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findUnique: mocks.event },
    business: { findUnique: mocks.business },
    eventImageUpload: { findUnique: mocks.upload },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/categories.server", () => ({
  resolveEventCategories: async () => ({
    categoryId: "community",
    categoryTagNames: [],
  }),
}));
vi.mock("@/lib/cities.server", () => ({
  resolveEventCity: async () => ({
    city: "Austin",
    state: "TX",
    country: "US",
  }),
}));
vi.mock("@/lib/event-image-uploads", () => ({
  claimEventImageUpload: vi.fn(),
  replaceEventImageUpload: mocks.replaceImage,
  cleanupEventImageUploadsByIds: mocks.cleanup,
  isEventImageUploadClaimError: () => false,
}));
vi.mock("@/lib/event-payments", () => ({
  cancelEventPosting: vi.fn(),
  expireOpenEventCheckoutSessions: vi.fn(),
}));

import { createEventAction, updateEventAction } from "@/app/actions/events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const event = {
  id: "event",
  creatorId: "owner",
  businessId: "shop",
  status: "PUBLISHED",
  postingMethod: "SUBSCRIPTION",
  imageUrl: "https://example.com/original.png",
  recurrence: "NONE",
  timezone: "America/Chicago",
  startDate: new Date("2099-01-10T16:00:00Z"),
  endDate: new Date("2099-01-10T18:00:00Z"),
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
};
function form(overrides = {}) {
  const data = new FormData();
  Object.entries({
    eventId: "event",
    title: "Updated Community Market",
    description: "An updated community market with music and local food.",
    categoryId: "community",
    address: "123 Main Street",
    cityId: "austin",
    zipCode: "78701",
    businessId: "shop",
    startDate: "2099-01-10T10:00",
    endDate: "2099-01-10T12:00",
    timezone: "America/Chicago",
    imageUrl: event.imageUrl,
    ...overrides,
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.role = "USER";
  mocks.event.mockResolvedValue({ ...event });
  mocks.business.mockResolvedValue({
    id: "shop",
    ownerId: "owner",
    status: "ACTIVE",
  });
  mocks.access.mockResolvedValue({ hasMembershipAccess: true });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((callback) =>
    callback({ event: { updateMany: mocks.updateMany, update: mocks.update } }),
  );
  mocks.replaceImage.mockResolvedValue(["old-upload"]);
  mocks.cleanup.mockResolvedValue({ failed: 0 });
});

describe("live event editing", () => {
  it("still requires future dates when creating a new event", async () => {
    const result = await createEventAction({}, form({ startDate: "2000-05-24T10:00", endDate: "2000-05-24T12:00" }));
    expect(result.fieldErrors.endDate).toContain("future");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("saves details and a new photo on an ended published event without changing its dates or publication", async () => {
    const past = { ...event, startDate: new Date("2000-05-24T15:00:00Z"), endDate: new Date("2000-05-24T17:00:00Z") };
    mocks.event.mockResolvedValue(past);
    mocks.upload.mockResolvedValue({ id: "new-upload", userId: "owner", readyAt: new Date() });
    await updateEventAction({}, form({ startDate: "2000-05-24T10:00", endDate: "2000-05-24T12:00", imageUrl: "https://example.com/new.png" }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      title: "Updated Community Market", imageUrl: "https://example.com/new.png",
      startDate: past.startDate, endDate: past.endDate, status: "PUBLISHED", publishedAt: event.publishedAt,
    }) }));
    expect(redirect).toHaveBeenCalledWith("/dashboard/events?updated=1");
  });
  it("allows corrections to a published recurring series after its final occurrence", async () => {
    mocks.event.mockResolvedValue({ ...event, recurrence: "WEEKLY", startDate: new Date("2000-05-24T15:00:00Z"), endDate: new Date("2000-05-24T17:00:00Z"), recurrenceUntil: new Date("2000-05-31T17:00:00Z") });
    await updateEventAction({}, form({ startDate: "2000-05-24T10:00", endDate: "2000-05-24T12:00", recurrence: "WEEKLY", recurrenceUntil: "2000-05-31" }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recurrence: "WEEKLY", recurrenceUntil: new Date("2000-05-31T17:00:00Z"), status: "PUBLISHED" }) }));
  });
  it("updates details while preserving publication and refreshing public screens", async () => {
    await updateEventAction({}, form());
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: "owner",
          status: "PUBLISHED",
          updatedAt: event.updatedAt,
        }),
        data: expect.objectContaining({
          title: "Updated Community Market",
          status: "PUBLISHED",
          publishedAt: event.publishedAt,
        }),
      }),
    );
    expect(mocks.replaceImage).not.toHaveBeenCalled();
    for (const path of [
      "/events",
      "/events/results",
      "/events/event",
      "/dashboard/events",
      "/dashboard",
    ])
      expect(revalidatePath).toHaveBeenCalledWith(path);
    expect(redirect).toHaveBeenCalledWith("/dashboard/events?updated=1");
  });
  it("claims a replacement photo and cleans up the old upload after saving", async () => {
    mocks.upload.mockResolvedValue({
      id: "new-upload",
      userId: "owner",
      readyAt: new Date(),
    });
    await updateEventAction(
      {},
      form({ imageUrl: "https://example.com/new.png" }),
    );
    expect(mocks.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "PUBLISHED",
      imageUrl: "https://example.com/new.png",
    });
    expect(mocks.replaceImage).toHaveBeenCalledWith(expect.anything(), {
      eventId: "event",
      userId: "owner",
      uploadId: "new-upload",
    });
    expect(mocks.cleanup).toHaveBeenCalledWith(["old-upload"]);
  });
  it("removes the cover without unpublishing", async () => {
    await updateEventAction({}, form({ imageUrl: "" }));
    expect(mocks.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "PUBLISHED",
      imageUrl: "",
    });
    expect(mocks.replaceImage).toHaveBeenCalledWith(expect.anything(), {
      eventId: "event",
      userId: "owner",
      uploadId: null,
    });
  });
  it.each(["PENDING", "DRAFT"])(
    "keeps %s posts in their existing review state",
    async (status) => {
      mocks.event.mockResolvedValue({ ...event, status });
      await updateEventAction({}, form());
      expect(mocks.updateMany.mock.calls[0][0].data.status).toBe(status);
    },
  );
  it("rejects another owner's event", async () => {
    mocks.event.mockResolvedValue({ ...event, creatorId: "someone-else" });
    expect(await updateEventAction({}, form())).toMatchObject({
      error: "Event not found.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a photo uploaded by another account", async () => {
    mocks.upload.mockResolvedValue({
      id: "upload",
      userId: "someone-else",
      readyAt: new Date(),
    });
    expect(
      await updateEventAction(
        {},
        form({ imageUrl: "https://example.com/stolen.png" }),
      ),
    ).toMatchObject({ fieldErrors: { imageUrl: expect.any(String) } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps membership checks when editing a published post", async () => {
    mocks.access.mockResolvedValue({ hasMembershipAccess: false });
    expect(await updateEventAction({}, form())).toMatchObject({
      error: expect.stringContaining("active membership"),
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "DENIED"])(
    "rejects edits to %s events",
    async (status) => {
      mocks.event.mockResolvedValue({ ...event, status });
      expect(await updateEventAction({}, form())).toMatchObject({
        error: expect.stringContaining("cannot be reused"),
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("does not replace photos or clean uploads after an edit conflict", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateEventAction({}, form({ imageUrl: "" }))).toMatchObject({
      error: expect.stringContaining("another request"),
    });
    expect(mocks.replaceImage).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
});
