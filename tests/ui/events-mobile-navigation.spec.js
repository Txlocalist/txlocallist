import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile header behavior only");
});

test("events landing keeps the account action in a right-side hamburger menu", async ({ page }) => {
  await page.goto("/events");

  await expect(page.locator(".site-header > .nav > .login-btn")).toBeHidden();

  const menuButton = page.locator(".mobile-nav-menu summary");
  const brand = page.locator(".site-header .brand-logo");
  const menuBox = await menuButton.boundingBox();
  const brandBox = await brand.boundingBox();
  const viewport = page.viewportSize();

  expect(menuBox.x + menuBox.width / 2).toBeGreaterThan(viewport.width / 2);
  expect(brandBox.x).toBe(14);
  expect(brandBox.width).toBe(170);
  await expect(brand).toHaveCSS("transform", "none");

  await menuButton.click();
  await expect(page.locator(".mobile-nav-menu nav").getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
});

test("event results opens the primary site navigation from the right-side hamburger", async ({ page }) => {
  await page.goto("/events/results");

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  const brand = page.locator(".mobile-top .brand-image");
  const menuBox = await menuButton.boundingBox();
  const brandBox = await brand.boundingBox();
  const viewport = page.viewportSize();

  expect(menuBox.x + menuBox.width / 2).toBeGreaterThan(viewport.width / 2);
  expect(brandBox.x).toBeLessThan(24);

  await menuButton.click();
  const primaryMenu = page.getByRole("link", { name: "Businesses", exact: true });
  await expect(primaryMenu).toBeVisible();
  const homeLink = page.getByRole("link", { name: "Home", exact: true });
  await expect(homeLink).toBeVisible();
  await expect(homeLink).toHaveCSS("color", "rgb(45, 36, 30)");
  await expect(page.getByRole("link", { name: "Events", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.getByRole("button", { name: "All Events", exact: true })).toBeHidden();
});

test("business results aligns its mobile logo to the left", async ({ page }) => {
  await page.goto("/results");

  const logoBox = await page.locator(".mobile-logo-image").boundingBox();
  expect(logoBox.x).toBeLessThan(24);
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  expect((await menu.boundingBox()).x).toBeGreaterThan(page.viewportSize().width / 2);
  await menu.click();
  const header = page.locator(".mobile-logo-wrap");
  await expect(header.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Businesses", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("business mobile filters combine, reset and preserve the list within the viewport", async ({ page }) => {
  const requests = [];
  await page.route("**/api/search?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    await route.fulfill({ json: { success: true, data: {
      results: [{ id: "long", slug: "local-shop", name: "A Very Long Local Business Name".repeat(4), description: "LongBusinessDescription".repeat(20), city: { name: "Austin" }, categories: [{ name: "A Long Category Name", slug: "shops" }], activeJobCount: 2 }],
      page: 1, total: 1, hasMore: false,
    } } });
  });
  await page.goto("/results?q=local&page=2");
  await expect(page.locator(".gem-card")).toHaveCount(1);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const row = await page.locator(".list-item").boundingBox();
    expect(row.x + row.width).toBeLessThanOrEqual(width);
    const dock = await page.locator(".mobile-bottom-nav").boundingBox();
    expect(dock.x).toBe(0);
    expect(dock.width).toBe(width);
    expect(dock.y + dock.height).toBeCloseTo(844, 0);
  }
  await expect(page.locator(".mobile-bottom-nav")).toHaveCSS("background-color", "rgb(253, 248, 238)");
  const filters = page.getByRole("button", { name: "FILTERS", exact: true });
  await filters.click();
  const dialog = page.getByRole("dialog", { name: "Business Filters" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Austin", exact: true }).click();
  await dialog.getByRole("button", { name: "Shops", exact: true }).click();
  await dialog.getByRole("button", { name: "Hiring Now", exact: true }).click();
  await expect.poll(() => requests.at(-1)).toMatchObject({ q: "local", loc: "Austin", category: "shops", jobs: "1", page: "1" });
  await expect(dialog.getByRole("button", { name: "Shops", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Show Results", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".list-item")).toHaveCount(1);
  await expect(filters).toBeFocused();
  await page.reload();
  await filters.click();
  await expect(dialog.getByRole("button", { name: "Austin", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Hiring Now", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "All Businesses Clear every filter" }).click();
  await expect.poll(() => requests.at(-1)).toEqual({ page: "1", sort: "newest" });
  await expect(page).toHaveURL(/browse=all/);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(filters).toBeFocused();
});
