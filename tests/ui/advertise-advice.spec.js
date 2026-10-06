import { test, expect } from "@playwright/test";

test("profile advice opens by keyboard and restores focus after every dismissal", async ({ page }) => {
  await page.goto("/advertise-advice");
  const trigger = page.getByRole("button", { name: "Advice on Crafting Your Look", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Advice on Crafting Your Look", exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close profile advice" });
  await expect(close).toBeFocused();
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(5);
  await expect(dialog.getByText("Up to 8MB per image", { exact: true })).toBeVisible();
  await expect(dialog.getByText("JPG, PNG, WEBP, or GIF", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await trigger.click();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("profile advice remains scrollable in a narrow short viewport", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/advertise-advice");
  await page.getByRole("button", { name: "Advice on Crafting Your Look", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Advice on Crafting Your Look", exact: true });
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.height).toBeLessThanOrEqual(600);
  const lastSection = dialog.getByRole("heading", { name: "Before You Publish", exact: true });
  await lastSection.scrollIntoViewIfNeeded();
  await expect(lastSection).toBeInViewport();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.screenshot({ path: `test-results/advertise-advice-${info.project.name}.png` });
});
