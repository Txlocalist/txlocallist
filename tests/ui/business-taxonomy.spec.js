import { test, expect } from "@playwright/test";

async function openBusinessCategoriesStep(page) {
  await page.goto("/new-business");
  await page.getByLabel("Business Name", { exact: false }).fill("Town Cafe");
  await page.getByLabel("Description", { exact: false }).fill("A neighborhood cafe serving the local community.");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByLabel("City *", { exact: true }).selectOption("Austin");
  await page.getByRole("button", { name: /Next/ }).click();
}

test("business creation offers searchable scrollable categories and preserves selections through the wizard", async ({ page }, info) => {
  await openBusinessCategoriesStep(page);
  const trigger = page.getByRole("button", { name: "Choose business categories", exact: true });
  const search = page.getByLabel("Search business categories", { exact: true });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("checkbox", { name: "Bakery", exact: true })).toHaveCount(0);
  await trigger.click();
  await expect(search).toBeFocused();
  await search.fill("bAk");
  await expect(page.getByRole("checkbox", { name: "Bakery", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Accountant", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Bakery", exact: true }).check();
  await expect(search).toBeVisible();
  await search.fill("no matching business");
  await expect(page.getByRole("checkbox", { name: "Bakery", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Bakery", exact: true })).toBeVisible();
  await search.fill("");

  const lastOption = page.getByRole("checkbox", { name: "Theater", exact: true });
  expect(await lastOption.evaluate((element) => {
    let parent = element.parentElement;
    while (parent) {
      if (["auto", "scroll"].includes(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return true;
      parent = parent.parentElement;
    }
    return false;
  })).toBe(true);
  await lastOption.scrollIntoViewIfNeeded();
  await lastOption.check();
  await search.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Remove Theater", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Back|Previous/ }).click();
  await trigger.click();
  await search.fill("Bakery");
  await expect(page.getByRole("checkbox", { name: "Bakery", exact: true })).toBeChecked();
  await search.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await trigger.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/business-categories-${info.project.name}.png` });
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "Create Listing", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.categoryIds)).toEqual(["business-Bakery", "business-Theater"]);
});

test("business edit preloads categories and tags and closes dropdowns on outside interaction", async ({ page }) => {
  await page.goto("/edit-business?selected=1");
  const categories = page.getByRole("button", { name: "Choose business categories", exact: true });
  const tags = page.getByRole("button", { name: "Choose tags", exact: true });
  await expect(page.getByRole("button", { name: "Remove Shopping", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Bakery", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Family Owned", exact: true })).toBeVisible();
  await categories.click();
  await page.getByLabel("Search business categories", { exact: true }).fill("Bakery");
  await expect(page.getByRole("checkbox", { name: "Bakery", exact: true })).toBeChecked();
  await page.getByLabel("Business Name", { exact: false }).click();
  await expect(categories).toHaveAttribute("aria-expanded", "false");
  await tags.click();
  await page.getByLabel("Search tags", { exact: true }).fill("Family");
  await expect(page.getByRole("checkbox", { name: "Family Owned", exact: true })).toBeChecked();
  await page.getByLabel("Business Name", { exact: false }).focus();
  await expect(tags).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Remove Bakery", exact: true }).click();
  await page.getByRole("button", { name: "Remove Family Owned", exact: true }).click();
  await categories.click();
  await page.getByLabel("Search business categories", { exact: true }).fill("Cafe");
  await page.getByRole("checkbox", { name: "Cafe", exact: true }).check();
  await page.getByLabel("Search business categories", { exact: true }).press("Escape");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.categoryIds)).toEqual(["business-Shopping", "business-Cafe"]);
  expect(await page.evaluate(() => window.businessSubmissions[0].tagIds)).toEqual([]);
});

test("business tags combine filtered selections and suggestions within the five-tag limit", async ({ page }, info) => {
  await openBusinessCategoriesStep(page);
  const trigger = page.getByRole("button", { name: "Choose tags", exact: true });
  const search = page.getByLabel("Search tags", { exact: true });
  await trigger.click();
  for (const name of ["Accessible", "Delivery", "Dog Friendly", "Family Owned"]) {
    await search.fill(name);
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await search.fill("Local Coffee");
  await page.getByRole("button", { name: "Suggest “Local Coffee”", exact: true }).click();
  await expect(page.getByText("5/5 selected", { exact: true })).toBeVisible();
  await search.fill("Free Parking");
  await expect(page.getByRole("checkbox", { name: "Free Parking", exact: true })).toBeDisabled();
  await search.fill("Fresh Bread");
  await expect(page.getByRole("button", { name: "Suggest “Fresh Bread”", exact: true })).toBeDisabled();
  await search.press("Escape");
  await page.getByRole("button", { name: "Remove Delivery", exact: true }).click();
  await trigger.click();
  await search.fill("Free Parking");
  await page.getByRole("checkbox", { name: "Free Parking", exact: true }).check();
  await search.press("Escape");
  await trigger.click();
  await search.fill("Local Coffee");
  await expect(page.getByRole("checkbox", { name: "Local Coffee", exact: true })).toBeChecked();
  await search.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await trigger.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/business-tags-${info.project.name}.png` });
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "Create Listing", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.tagIds)).toEqual(["tag-Accessible", "tag-Dog Friendly", "tag-Family Owned", "tag-Free Parking"]);
  expect(await page.evaluate(() => window.businessSubmissions[0].newTags)).toBe("Local Coffee");
});
