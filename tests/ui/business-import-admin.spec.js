import { test, expect } from "@playwright/test";

const CSV = "name,city,category\nTown Market,Austin,Shops\nCorner Store,Austin,Shops\n";
const FILE = { name: "complete-master.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) };
const HASH = "a".repeat(64);
const TAXONOMY_HASH = "b".repeat(64);
const PREVIEW = {
  fileHash: HASH, revision: 7, taxonomyDigest: TAXONOMY_HASH, canPublish: true, issues: [], issueCount: 0,
  rows: [{ name: "Town Market", city: "Austin", category: "Shops" }, { name: "Corner Store", city: "Austin", category: "Shops" }],
  summary: { total: 2, added: 1, changed: 1, removed: 1, unchanged: 0, hidden: 1 },
};

async function json(route, data, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

async function preparePreview(page) {
  await page.route("**/api/admin/other-businesses/preview", (route) => json(route, { success: true, data: PREVIEW }));
  await page.goto("/import-businesses");
  await page.getByLabel("Business spreadsheet", { exact: true }).setInputFiles(FILE);
  await page.getByRole("button", { name: "Preview changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toBeVisible();
}

test("admin reviews changes and publishes the exact file with its preview proof", async ({ page }) => {
  let publishBody = "";
  await page.route("**/api/admin/other-businesses/publish", async (route) => {
    publishBody = route.request().postDataBuffer().toString("utf8");
    await json(route, { success: true, data: {
      revision: 8, total: 2, lastImportedAt: "2026-09-29T14:00:00Z", lastFileName: FILE.name, lastImportedBy: "admin@example.com",
    } });
  });
  await preparePreview(page);
  await expect(page.getByText("Each upload replaces the entire “Other businesses” list.", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Town Market", exact: true })).toBeVisible();
  await expect(page.getByText("Publishing will replace the current list", { exact: false })).toContainText("remove 1 business missing");
  await page.screenshot({ path: test.info().outputPath("business-import-admin.png"), fullPage: true });
  await page.getByRole("button", { name: "Publish replacement list" }).click();
  await expect(page.getByRole("status")).toContainText("Your list is published.");
  await expect(page.getByText(FILE.name, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toHaveCount(0);
  expect(publishBody).toContain(CSV);
  expect(publishBody).toContain(HASH);
  expect(publishBody).toContain(TAXONOMY_HASH);
  expect(publishBody).toMatch(/name="revision"\r\n\r\n7/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("changing the file invalidates its preview and row errors block publication", async ({ page }) => {
  await preparePreview(page);
  await page.getByLabel("Business spreadsheet", { exact: true }).setInputFiles({ ...FILE, name: "corrected.csv" });
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toHaveCount(0);
  await page.route("**/api/admin/other-businesses/preview", (route) => json(route, { success: true, data: {
    ...PREVIEW, canPublish: false, issueCount: 1, issues: [{ row: 2, field: "city", message: "Choose an available city." }],
  } }));
  await page.getByRole("button", { name: "Preview changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Row 2, city:");
  await expect(page.getByRole("alert")).toContainText("Choose an available city.");
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toHaveCount(0);
});

test("a stale publication requires a fresh preview", async ({ page }) => {
  await page.route("**/api/admin/other-businesses/publish", (route) => json(route, {
    success: false, error: "Another administrator changed the list.",
  }, 409));
  await preparePreview(page);
  await page.getByRole("button", { name: "Publish replacement list" }).click();
  await expect(page.getByRole("alert")).toContainText("Another administrator changed the list.");
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview changes", exact: true })).toBeEnabled();
});

test("a lost publication response does not leave a blind retry button", async ({ page }) => {
  await page.route("**/api/admin/other-businesses/publish", (route) => route.abort("failed"));
  await preparePreview(page);
  await page.getByRole("button", { name: "Publish replacement list" }).click();
  await expect(page.getByRole("alert")).toContainText("We couldn’t confirm whether publication completed.");
  await expect(page.getByRole("button", { name: "Publish replacement list" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview changes", exact: true })).toBeEnabled();
});

test("downloads the current spreadsheet and shows available taxonomy", async ({ page }) => {
  await page.route("**/api/admin/other-businesses/export?format=csv", (route) => route.fulfill({
    status: 200, contentType: "text/csv; charset=utf-8", body: CSV,
  }));
  await page.goto("/import-businesses");
  await page.getByText("View available cities and business categories", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Manage cities", exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("tx-localist-import-businesses-current.csv");
});
