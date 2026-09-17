import { expect, test } from "@playwright/test";

for (const admin of [false, true]) {
  test(`${admin ? "admin" : "user"} dashboard drawer supports navigation, keyboard and home`, async ({ page }, info) => {
    await page.goto(`/dashboard-shell${admin ? "?admin=1" : ""}`);
    const trigger = page.getByRole("button", { name: "Open dashboard navigation" });
    const dialog = page.getByRole("dialog", { name: admin ? "Admin navigation" : "Dashboard navigation", exact: true });
    const home = page.getByRole("link", { name: "Back to Website" });
    await expect(home).toHaveAttribute("href", "/");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Page action" })).toBeVisible();
    if (info.project.name === "desktop") {
      await expect(trigger).toBeHidden();
      const sidebar = page.getByRole("complementary");
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole("link", { name: admin ? "User Dashboard" : "Admin Dashboard", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      const contentBox = await page.getByRole("main").boundingBox();
      expect(sidebarBox.x + sidebarBox.width).toBeLessThan(contentBox.x);
      await page.screenshot({ path: `test-results/dashboard-${admin ? "admin" : "user"}-desktop.png` });
      await home.click();
      await expect(page).toHaveURL(/\/$/);
      return;
    }
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox.x).toBeLessThan(30);
    await trigger.click();
    await expect(dialog).toBeVisible();
    const panel = dialog.locator(":scope > div");
    await expect(panel).toHaveCSS("transform", "none");
    const panelBox = await panel.boundingBox();
    expect(panelBox.x).toBe(0);
    expect(panelBox.width).toBeLessThan(page.viewportSize().width);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const close = dialog.getByRole("button", { name: "Close dashboard navigation" });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Log out" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    await expect(dialog.locator("aside")).toBeInViewport();
    await dialog.getByRole("link").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/dashboard-${admin ? "admin" : "user"}-${info.project.name}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await trigger.click();
    await page.mouse.click(page.viewportSize().width - 10, 100);
    await expect(dialog).not.toBeVisible();
    await trigger.click();
    await dialog.getByRole("link", { name: admin ? "User Dashboard" : "Admin Dashboard", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(trigger).toBeHidden();
    await expect(page.getByRole("complementary")).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await home.click();
    await expect(page).toHaveURL(/\/$/);
  });
}
