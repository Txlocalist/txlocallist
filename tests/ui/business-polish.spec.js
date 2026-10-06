import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Use the app's locally built fonts for visual checks when a build is available.
async function loadBrandFonts(page) {
  const dir = resolve(".next/static/chunks");
  if (!existsSync(dir)) return;
  const rules = readdirSync(dir)
    .filter((name) => name.endsWith(".css"))
    .flatMap((name) =>
      [
        ...readFileSync(resolve(dir, name), "utf8").matchAll(
          /@font-face\{[^}]+\}/g,
        ),
      ].map(([rule]) => rule),
    )
    .filter((rule) =>
      /font-family:(Shrikhand|Bungee|Space Grotesk);/.test(rule),
    );
  if (!rules.length) return;
  await page.route("**/brand-test-fonts/*", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    await route.fulfill({
      contentType: "font/woff2",
      body: readFileSync(resolve(".next/static/media", name)),
    });
  });
  await page.addStyleTag({
    content:
      rules.join("\n").replaceAll("../media/", "/brand-test-fonts/") +
      ':root { --font-display: Shrikhand; --font-accent: Bungee; --font-sans: "Space Grotesk"; }',
  });
  await page.evaluate(() => document.fonts.ready);
}

test("contact actions and hiring badge are usable at all viewport sizes", async ({
  page,
}, info) => {
  await page.goto("/listing-updates/business-polish");
  await loadBrandFonts(page);
  const call = page.getByRole("link", { name: /Give us a call/ });
  const website = page.getByRole("link", { name: /Visit website/ });
  await expect(call).toHaveAttribute("href", "tel:7135550186");
  await expect(website).toHaveAttribute(
    "href",
    "https://townmarket.example.com",
  );
  await expect(website).toHaveAttribute("rel", "noopener noreferrer");
  expect((await call.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.getByRole("link", { name: /We’re hiring/ }).click();
  await expect(page).toHaveURL(/#join-the-crew$/);
  await expect(
    page.getByRole("link", { name: "Join the crew" }),
  ).toHaveAttribute("href", "/apply");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/business-polish-${info.project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(call).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("all three photos are visible and the lightbox supports keyboard and focus restoration", async ({
  page,
}, info) => {
  await page.goto("/listing-updates/business-polish");
  await loadBrandFonts(page);
  const photos = page.getByRole("button", {
    name: /^View photo \d of Town Market$/,
  });
  await expect(photos).toHaveCount(3);
  for (const photo of await photos.all()) {
    const box = await photo.boundingBox();
    expect(box.width).toBeGreaterThan(100);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  }
  await photos.nth(1).click();
  const dialog = page.getByRole("dialog", {
    name: "Town Market photo gallery",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Photo 2 of 3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close gallery" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("Photo 3 of 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("Photo 1 of 3", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Show photo 2", exact: true })
    .click();
  await expect(dialog.getByText("Photo 2 of 3", { exact: true })).toBeVisible();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: `test-results/business-lightbox-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(photos.nth(1)).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await page.getByRole("button", { name: "View all 3 photos" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close gallery" }).click();
  await expect(
    page.getByRole("button", { name: "View all 3 photos" }),
  ).toBeFocused();
});

test("single-photo and missing contact or hiring data leave no empty controls", async ({
  page,
}) => {
  await page.goto(
    "/listing-updates/business-polish?photos=1&noPhone=1&noHiring=1",
  );
  await expect(page.getByRole("link", { name: /Give us a call/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: /We’re hiring/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Join the crew" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "View photo", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "View photo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/listing-updates/business-polish?photos=2&noWebsite=1");
  await expect(
    page.getByRole("button", { name: /^View photo \d of Town Market$/ }),
  ).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Visit website/ })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.goto(
    "/listing-updates/business-polish?photos=0&noWebsite=1&noPhone=1",
  );
  await expect(
    page.getByRole("navigation", { name: "Contact Town Market" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Take a look around" }),
  ).toHaveCount(0);
});
