import { test, expect } from "@playwright/test";
import { loadBrandFonts } from "./brand-fonts";

const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

async function fillOffer(page, index = 0) {
  await page.getByRole("button", { name: "Add offer", exact: true }).click();
  await page.getByRole("textbox", { name: "Offer headline *", exact: true }).nth(index).fill("20% off your first visit");
  await page.getByRole("textbox", { name: "Offer details *", exact: true }).nth(index).fill("A neighborhood welcome for new customers.");
  await page.getByRole("textbox", { name: "How to redeem *", exact: true }).nth(index).fill("Show this coupon at checkout.");
  await page.getByRole("textbox", { name: "Coupon code (optional)", exact: true }).nth(index).fill("LOCAL20");
}

test("coupons have responsive tickets, a working anchor and copy feedback", async ({ page }, info) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => { window.copiedCode = text; } } }); });
  await page.goto("/listing-updates/business-polish?offers=3");
  await loadBrandFonts(page);
  const badge = page.getByRole("link", { name: "Special Offer", exact: true });
  await expect(badge).toHaveAttribute("href", "/business/town-market#special-offers");
  await expect(page.getByRole("link", { name: /We’re hiring/ })).toBeVisible();
  const coupons = page.locator("#special-offers article");
  await expect(coupons).toHaveCount(3);
  await page.getByRole("button", { name: "Copy code for 20% off your first visit" }).click();
  await expect(coupons.first().getByRole("status")).toHaveText("Coupon code copied.");
  expect(await page.evaluate(() => window.copiedCode)).toBe("HEYNEIGHBOR");
  const first = await coupons.first().boundingBox();
  const second = await coupons.nth(1).boundingBox();
  expect(info.project.name === "mobile" ? second.y > first.y : Math.abs(second.y - first.y) < 2).toBe(true);
  expect(first.y).toBeLessThan((await page.getByRole("heading", { name: "Take a look around" }).boundingBox()).y);
  await noOverflow(page);
  await page.screenshot({ path: `test-results/business-offers-${info.project.name}.png`, fullPage: true });
  await page.locator("#special-offers").screenshot({ path: `test-results/coupons-preview-${info.project.name}.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/listing-updates/business-polish?offers=1");
  await expect(page.locator("#special-offers article")).toHaveCount(1);
});

test("clipboard failure leaves a selectable code and instructions", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("denied"); } } }); });
  await page.goto("/listing-updates/business-polish?offers=1");
  await page.getByRole("button", { name: "Copy code for 20% off your first visit" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#special-offers").getByRole("status")).toContainText("Select and copy");
  await expect(page.locator("#special-offers code")).toHaveText("HEYNEIGHBOR");
  await page.goto("/listing-updates/business-polish");
  await expect(page.locator("#special-offers")).toHaveCount(0);
});

test("owners preview, pause, remove and save up to three offers", async ({ page }, info) => {
  await page.goto("/edit-business");
  await fillOffer(page);
  await expect(page.getByRole("article", { name: "20% off your first visit" })).toBeVisible();
  await page.getByLabel("Offer enabled", { exact: true }).uncheck();
  await expect(page.getByRole("article").getByText("Paused", { exact: true })).toBeVisible();
  await page.getByLabel("Offer enabled", { exact: true }).check();
  await page.getByLabel("Start date (optional)").fill("2099-01-01");
  await expect(page.getByRole("article").getByText("Scheduled", { exact: true })).toBeVisible();
  await page.getByLabel("Start date (optional)").fill("");
  await page.getByLabel("End date (optional)").fill("2000-01-01");
  await expect(page.getByRole("article").getByText("Expired", { exact: true })).toBeVisible();
  await page.getByLabel("End date (optional)").fill("");
  await fillOffer(page, 1);
  await fillOffer(page, 2);
  await expect(page.getByRole("button", { name: "Add offer", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove offer 2" }).click();
  await expect(page.getByRole("button", { name: "Add offer", exact: true })).toBeEnabled();
  await noOverflow(page);
  await page.screenshot({ path: `test-results/business-offer-editor-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.offers?.length)).toBe(2);
});

test("setup includes offer validation, preview and review", async ({ page }) => {
  await page.goto("/new-business");
  await page.getByLabel("Business Name", { exact: false }).fill("Town Market");
  await page.getByLabel("Description", { exact: false }).fill("A neighborhood market serving local shoppers.");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.locator("#cityId").selectOption("Austin");
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: "Add offer", exact: true }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText("Offer 1: headline is required.")).toBeVisible();
  await page.getByRole("button", { name: "Remove offer 1" }).click();
  await fillOffer(page);
  await page.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByText("Code: LOCAL20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create Listing", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.businessSubmissions?.[0]?.offers?.[0]?.code)).toBe("LOCAL20");
});

async function mockOffers(page) {
  await page.route("**/api/other-businesses?**", (route) => route.fulfill({ json: { success: true, data: { results: [], total: 0 } } }));
  await page.route("**/api/search?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get("page") || 1);
    route.fulfill({ json: { success: true, data: { page: pageNumber, total: 2, pageSize: 1, hasMore: pageNumber < 2, results: [{ id: String(pageNumber), slug: "town-market", name: `Town Market ${pageNumber}`, description: "A friendly local market.", city: { name: "Austin" }, categories: [{ slug: "shops", name: "Shops" }], isHiring: true, offerWindows: [{ enabled: true }] }] } } });
  });
}

test("offer filtering persists with hiring, sorting, pagination and browser history", async ({ page }, info) => {
  await mockOffers(page);
  await page.goto("/results?offers=1&jobs=1&loc=Austin&category=shops");
  await expect(page.getByRole("button", { name: "Remove Coupons/Special Offer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Special Offer", exact: true })).toHaveAttribute("href", "/business/town-market#special-offers");
  await page.getByRole("button", { name: "Next", exact: true }).filter({ visible: true }).click();
  await expect(page.locator(".gem-name")).toHaveText("Town Market 2");
  await page.getByLabel("Sort by").selectOption("name-asc");
  expect(new URL(page.url()).searchParams.get("offers")).toBe("1");
  expect(new URL(page.url()).searchParams.get("jobs")).toBe("1");
  await page.goBack();
  await expect(page.locator(".gem-name")).toHaveText("Town Market 2");
  await page.goForward();
  await page.reload();
  await expect(page.getByLabel("Sort by")).toHaveValue("name-asc");
  await expect(page.getByRole("heading", { name: "Other businesses" })).toHaveCount(0);
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".list-item").getByRole("link", { name: "Special Offer", exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Remove Coupons/Special Offer" }).click();
  expect(new URL(page.url()).searchParams.has("offers")).toBe(false);
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Coupons/Special Offer", exact: true }).filter({ visible: true }).click();
  expect(new URL(page.url()).searchParams.get("offers")).toBe("1");
});

test("saved businesses use the same active offer filter", async ({ page }) => {
  await page.goto("/results?browse=favorites&offers=1");
  await expect(page.locator(".gem-name")).toHaveText(["Alpha"]);
  await page.getByRole("button", { name: "Remove Coupons/Special Offer" }).click();
  await expect(page.locator(".gem-name")).toHaveCount(6);
});
