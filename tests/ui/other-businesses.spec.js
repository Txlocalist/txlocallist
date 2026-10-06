import { test, expect } from "@playwright/test";

const otherBusiness = (number) => ({
  id: `other-${number}`,
  name: `Neighborhood Shop ${String(number).padStart(2, "0")}`,
  city: { id: "austin", name: "Austin", slug: "austin" },
  category: { id: "shops", name: "Shops", slug: "shops" },
});

async function mockFullListings(page, { empty = false } = {}) {
  await page.route("**/api/events?*", (route) => route.fulfill({ json: { events: [], total: 0, page: 1, hasMore: false } }));
  await page.route("**/api/search?*", (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get("page") || 1);
    return route.fulfill({ json: { success: true, data: {
      results: empty ? [] : [{ id: `full-${current}`, name: `Full listing ${current}`, slug: `full-${current}`, city: { name: "Austin" } }],
      total: empty ? 0 : 2, page: current, pageSize: 1, hasMore: !empty && current < 2,
    } } });
  });
}

async function mockOthers(page, handler) {
  const requests = [];
  await page.route("**/api/other-businesses?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    if (handler) return handler(route, params);
    const current = Number(params.get("page") || 1);
    const rows = Array.from({ length: 27 }, (_, index) => otherBusiness(index + 1));
    return route.fulfill({ json: { success: true, data: { results: rows.slice((current - 1) * 25, current * 25), total: 27, page: current, pageSize: 25, hasMore: current < 2, revision: "first" } } });
  });
  return requests;
}

test("other businesses remain below full listings and page independently", async ({ page }, info) => {
  await mockFullListings(page);
  const requests = await mockOthers(page);
  await page.goto("/results?browse=all&loc=Austin&category=shops&q=Neighborhood");
  const section = page.getByRole("region", { name: "Other businesses", exact: true });
  await expect(section.getByRole("button", { name: /Learn about listing/ })).toHaveCount(25);
  expect((await section.boundingBox()).y).toBeGreaterThan((await page.locator(".grid-container").boundingBox()).y);
  expect(requests[0].get("q")).toBe("Neighborhood");
  expect(requests[0].get("loc")).toBe("Austin");
  expect(requests[0].get("category")).toBe("shops");
  await section.getByRole("button", { name: "Next other businesses" }).click();
  await expect(section.getByRole("button", { name: /Learn about listing/ })).toHaveCount(2);
  await section.screenshot({ path: `test-results/other-businesses-list-${info.project.name}.png` });
  await expect(page.locator(".gem-name")).toHaveText("Full listing 1");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  const requestsBeforeMainPaging = requests.length;
  await page.getByRole("navigation", { name: "Results pages", exact: true }).filter({ visible: true }).getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".gem-name")).toHaveText("Full listing 2");
  await expect(section.getByText("Page 2 of 2")).toBeVisible();
  expect(requests).toHaveLength(requestsBeforeMainPaging);
  await page.getByRole("button", { name: "Remove Query: Neighborhood", exact: true }).click();
  await expect(section.getByText("Page 1 of 2")).toBeVisible();
  await expect(section.getByRole("button", { name: /Learn about listing/ })).toHaveCount(25);
  expect(requests.at(-1).has("q")).toBe(false);
});

test("business invitation supports keyboard, dismissal and owner signup", async ({ page }, info) => {
  await mockFullListings(page, { empty: true });
  await mockOthers(page);
  await page.goto("/results?browse=all");
  await expect(page.getByRole("heading", { name: "No full listings matched that search." })).toBeVisible();
  const section = page.getByRole("region", { name: "Other businesses", exact: true });
  const trigger = section.getByRole("button", { name: "Learn about listing Neighborhood Shop 01", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Hey friend, are you down for some local business?", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Advertise your service and products on The Texas Localist", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Be seen. Build trust. Earn more local customers in your community.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Register an account and create a full business profile to give local customers another reason to choose you.", { exact: true })).toBeVisible();
  await dialog.screenshot({ path: `test-results/other-businesses-dialog-${info.project.name}.png` });
  const close = dialog.getByRole("button", { name: "Close business invitation" });
  await expect(close).toBeFocused();
  const signup = dialog.getByRole("link", { name: "Advertise My Business", exact: true });
  await expect(signup).toHaveAttribute("href", "/signup?intent=owner&next=%2Fdashboard%2Fbilling");
  const pricing = dialog.getByRole("link", { name: "View Pricing", exact: true });
  await expect(pricing).toHaveAttribute("href", "/post-your-business");
  await page.keyboard.press("Shift+Tab");
  await expect(pricing).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(5, 5);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await section.locator('a[href^="/business/"]').count()).toBe(0);
  await page.setViewportSize({ width: 320, height: 700 });
  await trigger.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(320);
});

test("other businesses are hidden for hiring, saved and event results", async ({ page }) => {
  await mockFullListings(page);
  const requests = await mockOthers(page);
  for (const search of ["jobs=1", "browse=favorites", "tab=events"]) {
    await page.goto(`/results?${search}`);
    await expect(page.getByRole("region", { name: "Other businesses", exact: true })).toHaveCount(0);
  }
  expect(requests).toHaveLength(0);
});

test("category pages retain their city scope and retry an isolated list error", async ({ page }) => {
  let fail = true;
  const requests = await mockOthers(page, (route) => {
    if (fail) return route.fulfill({ status: 500, json: { success: false } });
    return route.fulfill({ json: { success: true, data: { results: [otherBusiness(1)], total: 1, page: 1, pageSize: 25, hasMore: false, revision: "first" } } });
  });
  await page.goto("/categories/shops?city=austin");
  const section = page.getByRole("region", { name: "Other businesses", exact: true });
  await expect(section.getByRole("alert")).toContainText("could not be loaded");
  fail = false;
  await section.getByRole("button", { name: "Try again" }).click();
  await expect(section.getByRole("button", { name: /Learn about listing/ })).toHaveCount(1);
  expect(requests.every((params) => params.get("category") === "shops" && params.get("citySlug") === "austin" && !params.has("loc"))).toBe(true);
});

test("a changed import revision resets paging without showing stale businesses", async ({ page }) => {
  await mockFullListings(page);
  const requests = await mockOthers(page, (route, params) => {
    const current = Number(params.get("page"));
    const revision = requests.length > 1 ? "updated" : "first";
    return route.fulfill({ json: { success: true, data: { results: [otherBusiness(revision === "updated" ? 50 : 1)], total: 26, page: current, pageSize: 25, hasMore: current < 2, revision } } });
  });
  await page.goto("/results?browse=all");
  const section = page.getByRole("region", { name: "Other businesses", exact: true });
  await expect(section.getByRole("button", { name: /Neighborhood Shop 01/ })).toBeVisible();
  await section.getByRole("button", { name: "Next other businesses" }).click();
  await expect(section.getByText("Page 1 of 2")).toBeVisible();
  await expect(section.getByRole("button", { name: /Neighborhood Shop 50/ })).toBeVisible();
  await expect(section.getByRole("status")).toContainText("list has been updated");
  expect(requests.map((params) => params.get("page"))).toEqual(["1", "2", "1"]);
});

test("filter changes discard a delayed old response and hide an empty list", async ({ page }) => {
  await mockFullListings(page);
  let releaseOld;
  let oldFinished = false;
  const oldResponse = new Promise((resolve) => { releaseOld = resolve; });
  await mockOthers(page, async (route, params) => {
    const old = params.get("q") === "old";
    if (old) await oldResponse;
    await route.fulfill({ json: { success: true, data: { results: old ? [otherBusiness(1)] : [], total: old ? 1 : 0, page: 1, pageSize: 25, hasMore: false, revision: "first" } } });
    if (old) oldFinished = true;
  });
  const initialRequest = page.waitForRequest((request) => request.url().includes("/api/other-businesses?") && request.url().includes("q=old"));
  await page.goto("/results?browse=all&q=old");
  await initialRequest;
  await page.getByRole("button", { name: "Remove Query: old", exact: true }).click();
  await expect(page.getByRole("region", { name: "Other businesses", exact: true })).toHaveCount(0);
  releaseOld();
  await expect.poll(() => oldFinished).toBe(true);
  await expect(page.getByRole("region", { name: "Other businesses", exact: true })).toHaveCount(0);
});
