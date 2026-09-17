import { test, expect } from "@playwright/test";

const names = ["zebra", "Alpha", "beta", "alpha", "Delta", "Echo"];
async function mockResults(page, delayed = false) {
  await page.route("**/api/events?*", (route) => route.fulfill({ json: { events: [], total: 0, page: 1, hasMore: false } }));
  await page.route("**/api/search?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const sort = params.get("sort"); const currentPage = Number(params.get("page") || 1);
    if (delayed && sort === "oldest") await new Promise((resolve) => setTimeout(resolve, 650));
    const rows = names.map((name, index) => ({ id: String(index), name, slug: name, city: { name: "Austin" }, description: "Locally made goods and friendly service.", createdAt: `2026-01-0${index+1}`, favoritesCount: index }));
    rows.sort((a, b) => sort?.startsWith("name-") ? (a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * (sort === "name-desc" ? -1 : 1) || a.id.localeCompare(b.id)) : (Number(a.id) - Number(b.id)) * (sort === "oldest" ? 1 : -1));
    await route.fulfill({ json: { success: true, data: { results: rows.slice((currentPage-1)*3, currentPage*3), total: 6, page: currentPage, pageSize: 3, hasMore: currentPage < 2 } } });
  });
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

for (const kind of ["business", "event"]) {
  test(`${kind} deletion: focus, escape, pending, failure, retry and success`, async ({ page }, info) => {
    await page.goto(`/dialog?kind=${kind}`);
    const trigger = page.getByRole("button", { name: "Delete", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const keep = dialog.getByRole("button", { name: `Keep ${kind}` });
    await expect(keep).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: `Delete ${kind}` })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => window.deletionCalls || [])).toEqual([]);
    await trigger.click();
    await keep.click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/listing-${kind}-dialog-${info.project.name}.png` });
    await page.evaluate(() => { window.deletionError = "A payment is still being resolved."; });
    await dialog.getByRole("button", { name: `Delete ${kind}` }).click();
    await expect(keep).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText("A payment is still being resolved.");
    await expect(keep).toBeEnabled();
    await page.evaluate(() => { window.deletionError = ""; });
    await dialog.getByRole("button", { name: `Delete ${kind}` }).click();
    await expect(page.getByRole("status")).toHaveText("Town Market deleted.");
    await expect(page.getByRole("status")).toBeFocused();
    expect(await page.evaluate(() => window.deletionCalls)).toEqual([{ id: "fixture", confirmed: true }, { id: "fixture", confirmed: true }]);
  });
}

test("Explore retains sorting and filters across pagination, refresh, Back and Forward", async ({ page }, info) => {
  await mockResults(page);
  await page.goto("/results?loc=Austin&category=shops&jobs=1&sort=name-asc");
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha", "beta"]);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".gem-name")).toHaveText(["Delta", "Echo", "zebra"]);
  expect(new URL(page.url()).searchParams.get("jobs")).toBe("1");
  expect(new URL(page.url()).searchParams.get("category")).toBe("shops");
  expect(await page.evaluate(() => window.serverNavigations || [])).toEqual([]);
  await page.getByLabel("Sort by").selectOption("name-desc");
  await expect(page.locator(".gem-name")).toHaveText(["zebra", "Echo", "Delta"]);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.goBack();
  await expect(page.getByLabel("Sort by")).toHaveValue("name-asc");
  await expect(page.locator(".gem-name")).toHaveText(["Delta", "Echo", "zebra"]);
  await page.goForward();
  await page.reload();
  await expect(page.getByLabel("Sort by")).toHaveValue("name-desc");
  await expect(page.locator(".gem-name")).toHaveText(["zebra", "Echo", "Delta"]);
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `test-results/listing-explore-${info.project.name}.png`, fullPage: true });
  await page.getByLabel("Sort by").selectOption("popular");
  await expect(page.locator(".gem-name")).toHaveText(["Echo", "Delta", "alpha"]);
  expect(new URL(page.url()).searchParams.get("loc")).toBe("Austin");
});

test("Explore only requests the visible result type", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (["/api/search", "/api/events"].includes(path)) requests.push(path);
  });
  await mockResults(page);
  await page.goto("/results");
  await expect(page.locator(".gem-name")).toHaveCount(3);
  expect(requests).toEqual(["/api/search"]);
  await page.getByLabel("Sort by").selectOption("oldest");
  await expect(page.locator(".gem-name")).toHaveText(["zebra", "Alpha", "beta"]);
  expect(requests).toEqual(["/api/search", "/api/search"]);
  expect(await page.evaluate(() => window.serverNavigations || [])).toEqual([]);
  requests.length = 0;
  await page.goto("/results?tab=events");
  await expect.poll(() => requests).toEqual(["/api/events"]);
});

test("Explore ignores a slow response from an older sort", async ({ page }) => {
  await mockResults(page, true);
  await page.goto("/results?sort=newest");
  await expect(page.locator(".gem-name")).toHaveText(["Echo", "Delta", "alpha"]);
  await Promise.all([
    page.waitForRequest((request) => request.url().includes("/api/search?") && request.url().includes("sort=oldest")),
    page.getByLabel("Sort by").selectOption("oldest"),
  ]);
  await page.getByLabel("Sort by").selectOption("name-asc");
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha", "beta"]);
  await page.waitForTimeout(800); // Let the deliberately delayed old response arrive.
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha", "beta"]);
});

test("saved dates and filters persist through navigation", async ({ page }) => {
  await page.goto("/saved?city=Austin&sort=oldest&q=alpha");
  await expect(page.getByLabel("Sort by")).toHaveValue("oldest");
  await expect(page.getByLabel("Sort by").locator("option[value=oldest]")).toHaveText("Oldest saved");
  await expect(page.locator("article h2")).toHaveText(["Alpha", "alpha"]);
  await page.getByLabel("Sort by").selectOption("newest");
  await expect(page.locator("article h2")).toHaveText(["alpha", "Alpha"]);
  await page.reload();
  await expect(page.getByLabel("Search saved businesses")).toHaveValue("alpha");
  await expect(page.getByRole("combobox", { name: "City", exact: true })).toHaveValue("Austin");
  await noHorizontalOverflow(page);
});

test("event cards and lists sort independently of chronological calendar dates", async ({ page }, info) => {
  await page.goto("/events/results?sort=name-asc");
  await expect(page.locator(".card-title")).toHaveText(["Alpha", "alpha", "beta", "Delta", "Echo", "zebra"].map((name) => `${name}Town Hall`));
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".list-detail strong")).toHaveText(["Alpha", "alpha", "beta", "Delta", "Echo", "zebra"]);
  await page.getByLabel("Sort by").selectOption("oldest");
  await expect(page.locator(".list-detail strong")).toHaveText(names);
  expect(await page.evaluate(() => window.serverNavigations || [])).toEqual([]);
  await page.goBack();
  await expect(page.getByLabel("Sort by")).toHaveValue("name-asc");
  await expect(page.locator(".list-detail strong")).toHaveText(["Alpha", "alpha", "beta", "Delta", "Echo", "zebra"]);
  await page.goForward();
  await expect(page.getByLabel("Sort by")).toHaveValue("oldest");
  await expect(page.locator(".list-detail strong")).toHaveText(names);
  await page.goBack();
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  const dates = await page.locator(".desktop-grid .day-cell:not(.dim) .day-number").allTextContents();
  // Calendar grid order is fixed by date regardless of card/list ordering.
  expect(dates.map(Number)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `test-results/listing-events-${info.project.name}.png`, fullPage: true });
  await page.getByLabel("Sort by").selectOption("upcoming");
  await expect(page.locator(".card-title")).toHaveText(names.map((name) => `${name}Town Hall`));
});

test("event search and filters restore with Back, Forward and reload", async ({ page }) => {
  await page.goto("/events/results?sort=name-asc&q=Alpha&loc=Austin%2C+TX&category=Community&date=2030-01-11");
  const search = page.getByRole("form", { name: "Search local events" });
  await expect(page.locator(".card-title")).toHaveText(["AlphaTown Hall"]);
  await search.getByRole("searchbox").fill("Echo");
  await search.getByPlaceholder("City", { exact: true }).fill("");
  await search.getByRole("button", { name: /Jan 11/ }).click();
  await page.getByRole("button", { name: "All Dates", exact: true }).filter({ visible: true }).click();
  await search.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Remove Community", exact: true }).click();
  await expect(page.locator(".card-title")).toHaveText(["EchoTown Hall"]);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Remove Community", exact: true })).toBeVisible();
  await page.goBack();
  await expect(search.getByRole("searchbox")).toHaveValue("Alpha");
  await expect(search.getByPlaceholder("City", { exact: true })).toHaveValue("Austin, TX");
  await expect(search.getByRole("button", { name: /Jan 11/ })).toBeVisible();
  await expect(page.locator(".card-title")).toHaveText(["AlphaTown Hall"]);
  await page.goForward();
  await expect(search.getByRole("searchbox")).toHaveValue("Echo");
  await expect(search.getByPlaceholder("City", { exact: true })).toHaveValue("");
  await expect(search.getByRole("button", { name: /All Dates/ })).toBeVisible();
  await expect(page.locator(".card-title")).toHaveText(["EchoTown Hall"]);
  await page.reload();
  await expect(search.getByRole("searchbox")).toHaveValue("Echo");
  await expect(page.locator(".card-title")).toHaveText(["EchoTown Hall"]);
  expect(await page.evaluate(() => window.serverNavigations || [])).toEqual([]);
});

test("new city appears in both Explore lists and business create/edit dropdowns", async ({ page }, info) => {
  await mockResults(page);
  await page.goto("/city");
  await page.getByLabel("City name").fill("Test Empty Town");
  await page.getByRole("button", { name: "Add city", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Test Empty Town is now available");
  await page.goto("/new-business");
  await page.getByLabel("Business Name", { exact: false }).fill("Town Market");
  await page.getByLabel("Description", { exact: false }).fill("A local market serving the community with handmade goods.");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.locator("#cityId option").filter({ hasText: "Test Empty Town" })).toHaveCount(1);
  await page.goto("/edit-business");
  await expect(page.locator("#cityId option").filter({ hasText: "Test Empty Town" })).toHaveCount(1);
  await page.goto("/results");
  const cityTrigger = info.project.name === "mobile" ? page.locator(".mobile-bottom-nav button").filter({ hasText: "FILTERS" }) : page.locator(".nav-link-btn").filter({ hasText: "CITIES" });
  await cityTrigger.click();
  await expect(page.getByRole("button", { name: /Test Empty Town/ })).toBeVisible();
  await page.goto("/events/results");
  if (info.project.name === "mobile") {
    await page.locator(".bottom-nav").getByRole("button", { name: /Filters/i }).click();
  } else {
    await page.locator(".sidebar").getByRole("button", { name: /Cities/i }).click();
  }
  await expect(page.getByRole("button", { name: /Test Empty Town/ })).toBeVisible();
});


test("Explore saved results honor URL filters and retain sort when removing a filter", async ({ page }) => {
  await page.goto("/results?browse=favorites&loc=Austin&q=alpha&sort=newest");
  await expect(page.locator(".gem-name")).toHaveText(["alpha", "Alpha"]);
  await page.getByLabel("Sort by").selectOption("oldest");
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha"]);
  await page.getByRole("button", { name: "Remove Query: alpha", exact: true }).click();
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha", "Echo"]);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("oldest");
  expect(new URL(page.url()).searchParams.get("browse")).toBe("favorites");
  await page.goBack();
  await expect(page.locator(".gem-name")).toHaveText(["Alpha", "alpha"]);
});
