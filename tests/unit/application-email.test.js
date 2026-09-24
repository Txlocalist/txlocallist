import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(async () => ({ data: { id: "mail-1" } })) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));

import { sendNewApplicationEmail } from "@/lib/email";

afterEach(() => vi.unstubAllEnvs());

describe("application email", () => {
  it("sends an escaped branded template and plain text with a dashboard link", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const result = await sendNewApplicationEmail({ to: "owner@example.com", businessName: "Town & Cafe", applicantName: '<img src=x onerror="alert(1)">', role: "Cook <Lead>", applicationId: "application-1" });
    expect(result.success).toBe(true);
    const message = mocks.send.mock.calls[0][0];
    expect(message.to).toEqual(["owner@example.com"]);
    expect(message.subject).toBe("New application for Town & Cafe");
    expect(message.html).toContain("TX LOCALIST");
    expect(message.html).toContain("Town &amp; Cafe");
    expect(message.html).toContain("Cook &lt;Lead&gt;");
    expect(message.html).not.toContain("<img");
    expect(message.html).toContain("/dashboard/applications?application=application-1#application-application-1");
    expect(message.html).toContain("View Application");
    expect(message.text).toContain("submitted a resume");
    expect(message.text).toContain("/dashboard/applications?application=application-1");
    expect(message.attachments).toBeUndefined();
  });

  it("reports missing email configuration", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendNewApplicationEmail({ to: "owner@example.com", businessName: "Town Cafe", applicantName: "Sam", role: "Cook", applicationId: "one" })).toMatchObject({ success: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
