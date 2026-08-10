import { expect, test } from "@playwright/test";

test("pricing distinguishes monthly membership from a one-time event post", async ({ page }) => {
  await page.goto("/pricing");

  await expect(page.getByRole("heading", { name: "Simple pricing for local reach." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local Business Membership" })).toBeVisible();
  await expect(page.getByText("per month", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event Calendar Post" })).toBeVisible();
  await expect(page.getByText("one time", { exact: true })).toBeVisible();
  await expect(page.getByText("The same price for a one-day or multi-day event")).toBeVisible();
});

test("the event offer preserves the requested route through signup", async ({ page }) => {
  await page.goto("/post-an-event");

  await expect(page.getByRole("heading", { name: "Put your event on the local calendar." })).toBeVisible();
  await expect(page.getByText("$10", { exact: true })).toBeVisible();
  await expect(page.getByText("Covers 1-31 consecutive calendar days.")).toBeVisible();

  const postLink = page.getByRole("link", { name: "Post an Event", exact: true }).first();
  await expect(postLink).toHaveAttribute("href", "/signup?next=/dashboard/events/new");
});

test("the event dashboard redirects signed-out visitors to login", async ({ page }) => {
  await page.goto("/dashboard/events");

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("event navigation fits and opens at a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dataset.homeMode = "events";
  });

  const header = page.locator("[data-event-landing-header]");
  await expect(header).toBeVisible();
  await header.locator("summary").click();

  const mobileNavigation = header.getByRole("navigation", {
    name: "Event mobile navigation",
  });
  await expect(mobileNavigation).toBeVisible();
  const bounds = await mobileNavigation.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
