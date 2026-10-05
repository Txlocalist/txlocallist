import { test, expect } from "@playwright/test";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

test.beforeEach(async ({ page }) => {
  await page.route("**/fixtures/photo-*.png", (route) => route.fulfill({ contentType: "image/png", body: image }));
  await page.route("**/api/business-photos/upload", async (route) => {
    await route.fulfill({ json: { success: true, files: [1, 2, 3].map((index) => ({
      url: `http://127.0.0.1:3199/fixtures/photo-${index}.png`, name: `Photo ${index}`,
    })) } });
  });
});

async function uploadThreePhotos(page) {
  await page.locator('input[type="file"]').setInputFiles([1, 2, 3].map((index) => ({
    name: `photo-${index}.png`, mimeType: "image/png", buffer: image,
  })));
  await expect(page.getByText("3 / 3 photos uploaded.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(3);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByText(/upgrade/i)).toHaveCount(0);
}

test("business creation uploads and submits three photos", async ({ page }) => {
  await page.goto("/new-business");
  await page.getByLabel("Business Name", { exact: false }).fill("Town Cafe");
  await page.getByLabel("Description", { exact: false }).fill("A neighborhood cafe serving the local community.");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByLabel("City *", { exact: true }).selectOption("Austin");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText("Add up to 3 business photos.", { exact: false })).toBeVisible();
  await uploadThreePhotos(page);
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "Create Listing", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.photos.length)).toBe(3);
});

test("business editing supports three photos and frees a slot after removal", async ({ page }, info) => {
  await page.goto("/edit-business");
  await uploadThreePhotos(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByText("3 / 3 photos uploaded.", { exact: false }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/business-photos-${info.project.name}.png` });
  await page.getByRole("button", { name: "Remove photo" }).first().click();
  await expect(page.getByText("2 / 3 photos uploaded.", { exact: false })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.photos.length)).toBe(2);
  expect(await page.evaluate(() => window.businessSubmissions[0].photos[0].name)).toBe("Photo 2");
});
