import { expect, test } from "@playwright/test";

test("health endpoint reports a live release without configuration details", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    release: expect.any(String),
  });
});
