import { test, expect } from "@playwright/test";

test("admin event categories appear in event forms and stay out of business categories", async ({ page }, info) => {
  await page.goto("/manage-categories/event");
  await page.getByRole("form", { name: "Add event category" }).getByLabel("Category name").fill("Robotics Workshops");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Robotics Workshops is now available in event forms");
  for (const route of ["/event-form", "/event-form-edit"]) {
    await page.goto(route);
    await page.getByLabel("Happening Category *", { exact: true }).selectOption({ label: "Robotics Workshops" });
    await page.getByRole("button", { name: route.endsWith("edit") ? "Save Changes" : "Continue", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.eventSubmissions?.[0]?.categoryId)).toBe("event-Robotics Workshops");
  }
  await page.goto("/edit-business");
  await expect(page.getByText("Robotics Workshops", { exact: true })).toHaveCount(0);
  await page.goto("/manage-categories/event");
  await page.getByRole("button", { name: "Edit Live Music", exact: true }).click();
  const edit = page.getByRole("form", { name: "Rename Live Music" });
  await edit.getByLabel("Category name").fill("Live Performances");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await edit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/categories-event-${info.project.name}.png` });
  await edit.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toContainText("Live Performances saved");
  expect(await page.evaluate(() => window.categorySubmissions[0])).toEqual({ type: "event", categoryId: "event-Live Music", expectedName: "Live Music", name: "Live Performances" });
});

test("admin business categories stay separate and failed renames preserve the draft", async ({ page }) => {
  await page.goto("/manage-categories/business");
  await page.getByLabel("Category name").fill("Pet Grooming");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("status")).toContainText("Pet Grooming is now available in business forms");
  await page.goto("/new-business");
  await page.getByLabel("Business Name", { exact: false }).fill("Town Pet Care");
  await page.getByLabel("Description", { exact: false }).fill("Friendly local pet grooming and care for your best friend.");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByLabel("City *", { exact: true }).selectOption("Austin");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("checkbox", { name: "Pet Grooming", exact: true })).toBeVisible();
  await page.goto("/edit-business");
  await expect(page.getByRole("checkbox", { name: "Pet Grooming", exact: true })).toBeVisible();
  await page.goto("/event-form");
  await expect(page.locator("#category option").filter({ hasText: "Pet Grooming" })).toHaveCount(0);
  await page.goto("/manage-categories/business");
  await page.getByRole("button", { name: "Edit Shopping", exact: true }).click();
  const edit = page.getByRole("form", { name: "Rename Shopping" });
  await edit.getByLabel("Category name").fill("Local Retail");
  await page.evaluate(() => { window.categoryError = "That business category already exists."; });
  await edit.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(edit.getByLabel("Category name")).toHaveValue("Local Retail");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toHaveCount(0);
});
