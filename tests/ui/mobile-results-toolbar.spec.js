import { expect, test } from "@playwright/test";

test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile", "Mobile layout only"));

async function checkToolbar(page, selector) {
  const toolbar = page.locator(selector);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const sort = await toolbar.getByLabel("Sort by").boundingBox();
    const filters = await toolbar.getByRole("button", { name: "Filters", exact: true }).boundingBox();
    const views = await toolbar.getByRole("group", { name: "View mode" }).boundingBox();
    expect(Math.abs(sort.y - filters.y)).toBeLessThan(2);
    expect(Math.abs(views.y - filters.y)).toBeLessThan(2);
    expect(sort.x + sort.width).toBeLessThan(filters.x);
    expect(filters.x + filters.width).toBeLessThan(views.x);
    expect(views.x + views.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
}

test("business toolbar opens filters and pages from below the results", async ({ page }) => {
  await page.route("**/api/search?*", (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") || 1);
    return route.fulfill({ json: { success: true, data: { results: [{ id: String(pageNumber), slug: `shop-${pageNumber}`, name: `Shop ${pageNumber}`, city: { name: "Austin" } }], page: pageNumber, hasMore: pageNumber < 2 } } });
  });
  await page.goto("/results");
  await expect(page.locator(".gem-name")).toHaveText("Shop 1");
  await checkToolbar(page, ".results-header-right");
  await expect(page.locator(".results-header-right").getByRole("navigation", { name: "Results pages" })).toBeHidden();
  const pager = page.getByRole("navigation", { name: "Results pages" });
  expect((await pager.boundingBox()).y).toBeGreaterThan((await page.locator(".grid-container").boundingBox()).y);
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".gem-name")).toHaveText("Shop 2");
  await pager.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.locator(".gem-name")).toHaveText("Shop 1");
  await page.locator(".results-header-right").getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Business Filters" })).toBeVisible();
});

test("events use icon views and mobile pagination without paging the calendar", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fixturePagedEvents", "1"));
  await page.goto("/events/results?sort=name-asc");
  await expect(page.locator(".cards-grid .card-title")).toHaveCount(12);
  await checkToolbar(page, ".view-tools");
  await expect(page.locator(".summary-pill")).toBeHidden();
  const pager = page.getByRole("navigation", { name: "Results pages" });
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".cards-grid .card-title").first()).toContainText("Event 12");
  await page.reload();
  await expect(pager).toContainText("Page 2 of 3");
  await page.locator(".view-tools").getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".list-view .list-row")).toHaveCount(12);
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".list-view .list-row")).toHaveCount(1);
  await expect(pager.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.goBack();
  await expect(pager).toContainText("Page 2 of 3");
  await page.getByLabel("Sort by").selectOption("oldest");
  await expect(pager).toContainText("Page 1 of 3");
  await page.locator(".view-tools").getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".month-modal")).toBeVisible();
  const counts = await page.locator(".month-modal .count-badge").allTextContents();
  expect(counts.reduce((total, value) => total + Number(value), 0)).toBe(25);
});
