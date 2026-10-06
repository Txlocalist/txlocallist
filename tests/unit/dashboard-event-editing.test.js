import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), access: vi.fn(), events: vi.fn(), event: vi.fn(), businesses: vi.fn(),
  form: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url) => { throw new Error(`redirect:${url}`); },
  notFound: () => { throw new Error("not-found"); },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/account-access", () => ({ getAccountAccess: mocks.access, isStaffRole: () => false }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  event: { findMany: mocks.events, findUnique: mocks.event },
  business: { findMany: mocks.businesses },
} }));
vi.mock("@/lib/cities.server", () => ({ getSelectableCities: async () => [{ id: "austin", name: "Austin" }] }));
vi.mock("@/lib/categories.server", () => ({
  getEventCategoryOptions: async () => [{ id: "community", name: "Community" }],
  getEventTagOptions: async () => [],
}));
vi.mock("@/app/dashboard/DashboardShell", () => ({ DashboardLayout: ({ children }) => children }));
vi.mock("@/app/actions/events", () => ({ resubmitEventAction: vi.fn() }));
vi.mock("@/components/DeleteListingButton/DeleteListingButton", () => ({ default: () => null }));
vi.mock("@/components/ResultsSort/ResultsSort", () => ({ default: () => null }));
vi.mock("@/app/dashboard/events/new/CreateEventForm", () => ({ CreateEventForm: (props) => { mocks.form(props); return null; } }));

import DashboardPage from "@/app/dashboard/page";
import DashboardEventsPage from "@/app/dashboard/events/page";
import EditEventPage from "@/app/dashboard/events/[id]/edit/page";
import EventEditLink from "@/app/dashboard/events/EventEditLink";

const event = {
  id: "market", creatorId: "owner", title: "Saturday Market", description: "Food and music from local neighbors.",
  status: "PUBLISHED", postingMethod: "SUBSCRIPTION", recurrence: "NONE",
  imageUrl: "https://example.com/market.jpg", categoryId: "community",
  tags: [{ name: "Event Category: Community" }, { name: "Family" }],
  city: "Austin", state: "TX", address: "123 Main Street", zipCode: "78701",
  timezone: "America/Chicago", startDate: new Date("2099-01-10T16:00:00Z"), endDate: new Date("2099-01-10T18:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner", email: "neighbor@example.com", role: "USER" } });
  mocks.access.mockResolvedValue({ hasCreatorAccess: true, hasMembershipAccess: true });
  mocks.events.mockResolvedValue([event]);
  mocks.event.mockResolvedValue(event);
  mocks.businesses.mockResolvedValue([]);
});

describe("dashboard happening editing", () => {
  it("shows the owner's recent happenings with direct edit links on the dashboard", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(mocks.events).toHaveBeenCalledWith(expect.objectContaining({
      where: { creatorId: "owner", deletedAt: null }, take: 5,
    }));
    expect(html).toContain("Recent Happenings");
    expect(html).toContain('href="/dashboard/events/market/edit"');
    expect(html).toContain('aria-label="Edit Saturday Market"');
    expect(html).toContain("Manage all happenings");
  });
  it.each(["PUBLISHED", "PENDING", "DRAFT"])("offers editing for existing %s happenings", (status) => {
    const html = renderToStaticMarkup(createElement(EventEditLink, { event: { ...event, status }, hasCreatorAccess: true }));
    expect(html).toContain("/dashboard/events/market/edit");
  });
  it.each([
    { status: "CANCELLED" }, { status: "DENIED" },
  ])("does not offer editing for closed happenings: %j", (overrides) => {
    expect(renderToStaticMarkup(createElement(EventEditLink, { event: { ...event, ...overrides }, hasCreatorAccess: true }))).toBe("");
  });
  it("retains one-time editing without membership, while membership posts require access", () => {
    expect(renderToStaticMarkup(createElement(EventEditLink, { event, hasCreatorAccess: false }))).toBe("");
    expect(renderToStaticMarkup(createElement(EventEditLink, { event: { ...event, postingMethod: "ONE_TIME" }, hasCreatorAccess: false }))).toContain("Edit happening");
  });
  it("shows Edit for past published events in My Happenings, including staff accounts", async () => {
    mocks.session.mockResolvedValue({ user: { id: "owner", role: "ADMIN" } });
    mocks.events.mockResolvedValue([{
      ...event, postingMethod: "LEGACY", startDate: new Date("2000-05-24T16:00:00Z"),
      endDate: new Date("2000-05-24T18:00:00Z"), payments: [], reviews: [],
    }]);
    const html = renderToStaticMarkup(await DashboardEventsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('href="/dashboard/events/market/edit"');
    expect(html).toContain('aria-label="Edit Saturday Market"');
    expect(html).toContain("PUBLISHED");
  });
  it("loads saved details, tags, photo, and local times into the editor", async () => {
    renderToStaticMarkup(await EditEventPage({ params: Promise.resolve({ id: "market" }) }));
    expect(mocks.form).toHaveBeenCalledWith(expect.objectContaining({
      mode: "edit",
      initialEvent: expect.objectContaining({
        id: event.id, title: event.title, description: event.description, imageUrl: event.imageUrl,
        address: event.address, city: "Austin", categoryIds: ["community"], tags: "Family",
        startDate: "2099-01-10T10:00", endDate: "2099-01-10T12:00",
      }),
    }));
  });
  it("does not expose another user's event in the editor", async () => {
    mocks.event.mockResolvedValue({ ...event, creatorId: "someone-else" });
    await expect(EditEventPage({ params: Promise.resolve({ id: "market" }) })).rejects.toThrow("not-found");
    expect(mocks.form).not.toHaveBeenCalled();
  });
});
