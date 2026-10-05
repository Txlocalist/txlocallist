import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  user: { id: "organizer", role: "COMPLIMENTARY" },
  access: vi.fn(),
  businesses: vi.fn(),
  transaction: vi.fn(),
  business: vi.fn(),
  postingEnabled: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => mocks.user,
  getCurrentSession: async () => ({ user: mocks.user }),
}));
vi.mock("@/lib/account-access", () => ({
  getAccountAccess: mocks.access,
  isStaffRole: (role) => ["ADMIN", "MANAGER"].includes(role),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  business: { findMany: mocks.businesses, findUnique: mocks.business },
  $transaction: mocks.transaction,
} }));
vi.mock("@/lib/categories.server", () => ({
  getEventCategoryOptions: async () => [],
  getEventTagOptions: async () => [],
  resolveEventCategory: vi.fn(),
  resolveEventCategories: async () => ({ categoryId: "community", categoryTagNames: [] }),
}));
vi.mock("@/lib/cities.server", () => ({
  getSelectableCities: async () => [],
  resolveEventCity: async () => ({ city: "Austin", state: "TX", country: "US" }),
}));
vi.mock("@/lib/event-image-uploads", () => ({
  claimEventImageUpload: vi.fn(),
  cleanupEventImageUploadsByIds: vi.fn(),
  isEventImageUploadClaimError: () => false,
  replaceEventImageUpload: vi.fn(),
}));
vi.mock("@/lib/event-payments", () => ({
  cancelEventPosting: vi.fn(),
  createEventCheckoutSession: vi.fn(),
  expireOpenEventCheckoutSessions: vi.fn(),
}));
vi.mock("@/lib/pricing", async (original) => ({
  ...await original(),
  isEventPostingEnabled: mocks.postingEnabled,
}));
vi.mock("@/app/dashboard/DashboardShell", () => ({ DashboardLayout: ({ children }) => children }));
vi.mock("@/app/dashboard/events/new/CreateEventForm", () => ({
  CreateEventForm: () => createElement("form", { "aria-label": "Event form" }),
}));

import NewEventPage from "@/app/dashboard/events/new/page";
import { createEventAction, retryEventCheckoutAction } from "@/app/actions/events";
import { redirect } from "next/navigation";
import { createEventCheckoutSession } from "@/lib/event-payments";

function eventData() {
  const data = new FormData();
  Object.entries({
    title: "Community Open House",
    description: "Join our neighbors for a community open house.",
    categoryId: "community",
    address: "123 Main Street",
    cityId: "austin",
    zipCode: "78701",
    startDate: "2099-01-10T10:00",
    endDate: "2099-01-10T12:00",
    timezone: "America/Chicago",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "COMPLIMENTARY";
  mocks.access.mockResolvedValue({ hasMembershipAccess: true });
  mocks.businesses.mockResolvedValue([]);
  mocks.postingEnabled.mockReturnValue(false);
});

describe("event posting without a business profile", () => {
  it.each([false, true])("shows a create-profile CTA for complimentary accounts (one-time posting: %s)", async (enabled) => {
    mocks.postingEnabled.mockReturnValue(enabled);
    const html = renderToStaticMarkup(await NewEventPage());
    expect(html).toContain("Create Your Business Profile First");
    expect(html).toContain('href="/dashboard/businesses/new"');
    expect(html).toContain("before adding events to the calendar");
    expect(html).not.toContain("Posting Unavailable");
    expect(html).not.toContain('aria-label="Event form"');
  });

  it("points accounts with an inactive profile to their existing businesses", async () => {
    mocks.businesses.mockResolvedValue([{ id: "draft", name: "My Shop", status: "DRAFT" }]);
    const html = renderToStaticMarkup(await NewEventPage());
    expect(html).toContain("Activate Your Business Profile First");
    expect(html).toContain('href="/dashboard/businesses"');
  });

  it("allows the form once a complimentary profile is active", async () => {
    mocks.businesses.mockResolvedValue([{ id: "active", name: "My Shop", status: "ACTIVE" }]);
    const html = renderToStaticMarkup(await NewEventPage());
    expect(html).toContain('aria-label="Event form"');
    expect(html).not.toContain("Create Your Business Profile First");
  });

  it.each(["ADMIN", "MANAGER"])("preserves staff posting for %s", async (role) => {
    mocks.user.role = role;
    mocks.access.mockResolvedValue({ hasMembershipAccess: false });
    mocks.postingEnabled.mockReturnValue(true);
    expect(renderToStaticMarkup(await NewEventPage())).toContain('aria-label="Event form"');
  });

  it("keeps entitlement lookup errors distinct from a missing profile", async () => {
    mocks.access.mockResolvedValue(null);
    const html = renderToStaticMarkup(await NewEventPage());
    expect(html).toContain("could not verify your membership");
    expect(html).not.toContain('href="/dashboard/businesses/new"');
  });

  it.each([false, true])("returns the same CTA on direct submissions without creating or charging (one-time: %s)", async (enabled) => {
    mocks.postingEnabled.mockReturnValue(enabled);
    const result = await createEventAction({}, eventData());
    expect(result).toMatchObject({
      error: expect.stringContaining("before adding events to the calendar"),
      businessProfilePath: "/dashboard/businesses/new",
      businessProfileLabel: "Create Your Business Profile",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("asks for the existing active profile when a direct submission omits its business", async () => {
    mocks.businesses.mockResolvedValue([{ id: "active", status: "ACTIVE" }]);
    expect(await createEventAction({}, eventData())).toMatchObject({
      fieldErrors: { businessId: expect.stringContaining("Business Profile") },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an unlinked membership submission even when the old payment flag is enabled", async () => {
    mocks.businesses.mockResolvedValue([{ id: "active", status: "ACTIVE" }]);
    mocks.postingEnabled.mockReturnValue(true);
    expect(await createEventAction({}, eventData())).toMatchObject({
      fieldErrors: { businessId: expect.stringContaining("Business Profile") },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(createEventCheckoutSession).not.toHaveBeenCalled();
  });

  it("gives free accounts a membership CTA and rejects direct purchases", async () => {
    mocks.user.role = "USER";
    mocks.access.mockResolvedValue({ hasMembershipAccess: false });
    mocks.postingEnabled.mockReturnValue(true);
    const html = renderToStaticMarkup(await NewEventPage());
    expect(html).toContain('href="/dashboard/billing"');
    expect(html).toContain("Advertise Your Business");
    expect(html).not.toContain('aria-label="Event form"');
    expect(await createEventAction({}, eventData())).toMatchObject({
      businessProfilePath: "/dashboard/billing",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(createEventCheckoutSession).not.toHaveBeenCalled();
  });

  it("submits a member's business event for review without checkout", async () => {
    const create = vi.fn().mockResolvedValue({ id: "member-event" });
    mocks.business.mockResolvedValue({ id: "active", ownerId: "organizer", status: "ACTIVE" });
    mocks.transaction.mockImplementation((callback) => callback({ event: { create } }));
    const data = eventData();
    data.set("businessId", "active");
    await createEventAction({}, data);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      postingMethod: "SUBSCRIPTION", status: "PENDING", businessId: "active",
    }) });
    expect(redirect).toHaveBeenCalledWith("/dashboard/events?created=1");
    expect(createEventCheckoutSession).not.toHaveBeenCalled();
  });

  it("blocks old checkout retry actions before contacting Stripe", async () => {
    mocks.postingEnabled.mockReturnValue(true);
    await retryEventCheckoutAction(eventData());
    expect(redirect).toHaveBeenCalledWith("/dashboard/events?payment=unavailable");
    expect(createEventCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects a direct submission with four categories before creating an event", async () => {
    const data = eventData();
    ["music", "food", "outdoors", "community"].forEach((id) => data.append("categoryIds", id));
    expect(await createEventAction({}, data)).toMatchObject({
      fieldErrors: { category: "Choose no more than 3 event categories." },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
