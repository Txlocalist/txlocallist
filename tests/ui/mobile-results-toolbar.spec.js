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
    await expect(toolbar).toHaveCSS("gap", "6px");
    const viewButtons = toolbar.getByRole("group", { name: "View mode" }).getByRole("button");
    for (const button of await viewButtons.all()) {
      await expect(button).toHaveCSS("padding", "0px");
      const box = await button.boundingBox();
      const icon = await button.locator(".material-icons").boundingBox();
      expect(Math.abs(box.x + box.width / 2 - icon.x - icon.width / 2)).toBeLessThan(1);
      expect(Math.abs(box.y + box.height / 2 - icon.y - icon.height / 2)).toBeLessThan(1);
    }
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

test("event toolbar remains aligned when page CSS loads after the shared controls", async ({ page }) => {
  await page.goto("/events/results");
  // Reproduce production's chunk order instead of relying on Vite's import order.
  await page.evaluate(() => {
    const style = document.querySelector('style[data-vite-dev-id$="/events/results/events-results.css"]');
    if (!style) throw new Error("Event page stylesheet missing from fixture");
    document.head.appendChild(style);
  });
  await checkToolbar(page, ".view-tools");
  const filters = page.locator(".view-tools .mobile-filter-btn");
  await expect(filters).toHaveCSS("border-top-color", "rgb(248, 237, 212)");
  await expect(filters).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(filters).toHaveCSS("padding", "0px 10px");
  await expect(page.locator(".events-results")).toHaveCSS("background-color", "rgb(13, 10, 8)");
  await expect(page.locator(".events-results")).toHaveCSS("background-image", "none");
  await filters.click();
  await expect(page.locator(".drawer.open").getByRole("heading", { name: "Browse Filters" })).toBeVisible();
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

test("event results omit the duplicate daily schedule panel on mobile", async ({ page }) => {
  await page.goto("/events/results");
  const plannerPanels = page.locator(".planner > .panel");
  await expect(plannerPanels).toHaveCount(2);
  await expect(plannerPanels.nth(0)).toBeVisible();
  await expect(plannerPanels.nth(1)).toBeHidden();
  await expect(page.getByText("Pick a day", { exact: true })).toBeHidden();
  await expect(page.getByText("Choose a calendar date.", { exact: true })).toBeHidden();
});
