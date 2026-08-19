import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(async () => ({ id: "user_1" })),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  put: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/event-image-uploads", () => ({
  consumeEventImageUploadRateLimit: mocks.consumeRateLimit,
  hasValidEventImageSignature: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventImageUpload: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/event-images/upload/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("event image upload route", () => {
  it("returns an actionable 503 while the upload schema is missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob_test_token");
    mocks.consumeRateLimit.mockRejectedValueOnce(
      Object.assign(new Error("The table does not exist in the current database"), {
        code: "P2021",
      }),
    );

    const response = await POST(new Request("http://localhost/api/event-images/upload", {
      method: "POST",
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ success: false });
    expect(body.message).toContain("database update");
    expect(body.message).toContain("try again after deployment");
  });
});
