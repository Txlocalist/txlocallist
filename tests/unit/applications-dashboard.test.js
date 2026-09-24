import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), findMany: vi.fn(), redirect: vi.fn((url) => { throw new Error(`Redirect: ${url}`); }) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/account-access", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { businessApplication: { findMany: mocks.findMany } } }));
vi.mock("@/app/actions/auth", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }) => React.createElement("a", props, children) }));
vi.mock("@/components/ResultsSort/ResultsSort", () => ({ default: () => null }));
vi.mock("@/app/dashboard/DashboardFrame", () => ({ default: ({ title, navigation, children }) => React.createElement("main", null, title, navigation, children) }));

import { DashboardLayout } from "@/app/dashboard/DashboardShell";
import ApplicationsPage from "@/app/dashboard/applications/page";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.session.mockResolvedValue({ user: { id: "owner-1", role: "USER", email: "owner@example.com" } });
  mocks.access.mockResolvedValue({ hasCreatorAccess: true });
  mocks.findMany.mockResolvedValue([]);
});

describe("Applications dashboard", () => {
  it("shows an active Applications link inside the open Businesses menu", async () => {
    const html = renderToStaticMarkup(await DashboardLayout({ activeTab: "applications" }));
    expect(html).toMatch(/<details[^>]*open=""[^>]*>.*?Businesses.*?href="\/dashboard\/applications"/);
    expect(html).toMatch(/href="\/dashboard\/applications"[^>]*aria-current="page"/);
    expect(html).toContain(">Applications</span>");
  });

  it("does not show creator-only navigation to free browsing accounts", async () => {
    mocks.access.mockResolvedValue({ hasCreatorAccess: false });
    const html = renderToStaticMarkup(await DashboardLayout({ activeTab: "overview" }));
    expect(html).not.toContain('href="/dashboard/applications"');
  });

  it("retains the application destination through login", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(ApplicationsPage({ searchParams: Promise.resolve({ application: "app-1" }) })).rejects.toThrow("Redirect:");
    const loginUrl = new URL(mocks.redirect.mock.calls[0][0], "http://localhost");
    expect(loginUrl.searchParams.get("next")).toBe("/dashboard/applications?application=app-1#application-app-1");
  });

  it("limits the inbox to the owner's businesses and links directly to submitted resumes", async () => {
    mocks.findMany.mockResolvedValue([{ id: "app-1", firstName: "Sam", lastName: "Applicant", email: "sam@example.com", role: "Cook", resumeUrl: "https://example.com/resume.pdf", createdAt: new Date(), business: { name: "Town Cafe", slug: "town-cafe" } }]);
    const page = await ApplicationsPage({ searchParams: Promise.resolve({ application: "app-1" }) });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ business: { ownerId: "owner-1" } });
    const html = renderToStaticMarkup(page.props.children);
    expect(html).toContain('id="application-app-1"');
    expect(html).not.toContain("<details");
    expect(html).toMatch(/href="\/api\/dashboard\/applications\/app-1\/resume"[^>]*target="_blank"/);
    expect(html).toContain("View Resume");
  });

  it("disables the resume action when none was submitted", async () => {
    mocks.findMany.mockResolvedValue([{ id: "app-2", firstName: "Pat", lastName: "Applicant", email: "pat@example.com", role: "Cook", resumeUrl: " ", createdAt: new Date(), business: { name: "Town Cafe", slug: "town-cafe" } }]);
    const page = await ApplicationsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page.props.children);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>View Resume<\/button>/);
    expect(html).not.toContain('/api/dashboard/applications/app-2/resume');
  });
});
