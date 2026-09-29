import { test, expect } from "@playwright/test";

test("admin can rename cities and retains edits after an error", async ({ page }) => {
  await page.goto("/manage-cities");
  await page.getByRole("button", { name: "Edit Austin", exact: true }).click();
  await page.getByLabel("City name", { exact: true }).fill("New Austin");
  await page.evaluate(() => { window.cityError = "That city already exists."; });
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(page.getByLabel("City name", { exact: true })).toHaveValue("New Austin");
  await page.evaluate(() => { window.cityError = ""; });
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status").first()).toContainText("City renamed to New Austin");
  expect(await page.evaluate(() => window.citySubmissions.at(-1))).toMatchObject({ cityId: "Austin", expectedName: "Austin", name: "New Austin" });
});

test("deletion explains the fallback, allows cancellation, and protects Uncategorized", async ({ page }, info) => {
  await page.goto("/manage-cities");
  await expect(page.getByRole("button", { name: /(?:Edit|Delete) Uncategorized/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete Austin", exact: true }).click();
  await expect(page.getByText("All 3 businesses", { exact: false })).toBeVisible();
  await expect(page.getByText("Listings, subscriptions, and event payments will be preserved.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => window.citySubmissions || [])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/city-delete-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete city and reassign listings" })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete Austin", exact: true }).click();
  await page.getByRole("button", { name: "Delete city and reassign listings" }).click();
  await expect(page.getByRole("status").first()).toContainText("Listings moved to Uncategorized");
  expect(await page.evaluate(() => window.citySubmissions)).toEqual([{ cityId: "Austin", expectedName: "Austin", confirmed: "yes" }]);
});
