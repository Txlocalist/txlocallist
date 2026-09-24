import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), email: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { business: { findUnique: mocks.findUnique }, businessApplication: { create: mocks.create } } }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/account-access", () => ({ getAccountAccess: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendNewApplicationEmail: mocks.email }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { submitBusinessApplicationAction } from "@/app/actions/businesses";

const input = {
  slug: "town-cafe", firstName: "Sam", lastName: "Applicant", email: "sam@example.com",
  role: "Cook", resumeUrl: "https://example.com/resume.pdf", resumeFileName: "resume.pdf",
};

beforeEach(() => {
  mocks.findUnique.mockResolvedValue({ id: "business-1", name: "Town Cafe", status: "ACTIVE", isHiring: true, hiringRoles: '["Cook"]', owner: { email: "owner@example.com" } });
  mocks.create.mockResolvedValue({ id: "application-1" });
  mocks.email.mockResolvedValue({ success: true });
});

describe("application notifications", () => {
  it("saves the application before emailing the listing owner and refreshing the inbox", async () => {
    expect(await submitBusinessApplicationAction(input)).toMatchObject({ success: true });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ businessId: "business-1", email: input.email, resumeUrl: input.resumeUrl }) });
    expect(mocks.email).toHaveBeenCalledWith({ to: "owner@example.com", businessName: "Town Cafe", applicantName: "Sam Applicant", role: "Cook", applicationId: "application-1" });
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.email.mock.invocationCallOrder[0]);
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/applications");
  });

  it("does not email for invalid applications", async () => {
    expect(await submitBusinessApplicationAction({ ...input, role: "Unavailable role" })).toMatchObject({ success: false });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("does not email if saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.create.mockRejectedValueOnce(new Error("Database unavailable"));
    expect(await submitBusinessApplicationAction(input)).toMatchObject({ success: false });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["returned failure", "thrown failure"])("keeps a saved application successful after email %s", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (failure === "thrown failure") mocks.email.mockRejectedValueOnce(new Error("Unavailable"));
    else mocks.email.mockResolvedValueOnce({ success: false, error: "Unavailable" });
    expect(await submitBusinessApplicationAction(input)).toMatchObject({ success: true });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
