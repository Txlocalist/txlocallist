import { test, expect } from "@playwright/test";

test("organizer creates a weekly event with an optional final occurrence", async ({ page }, info) => {
  await page.addInitScript(() => { window.eventSubmissionError = "Please review your event details."; });
  await page.goto("/event-form");
  await page.getByLabel("Repeat", { exact: true }).selectOption("WEEKLY");
  await expect(page.getByLabel("First Occurrence Start", { exact: false })).toBeVisible();
  await page.getByLabel("Last Occurrence", { exact: false }).fill("2030-02-07");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.eventSubmissions?.length || 0)).toBe(1);
  expect(await page.evaluate(() => window.eventSubmissions[0])).toMatchObject({ recurrence: "WEEKLY", recurrenceUntil: "2030-02-07", timezone: "America/Chicago", businessId: "fixture-business" });
  await expect(page.getByRole("alert")).toContainText("Please review your event details.");
  await expect(page.getByLabel("Repeat", { exact: true })).toHaveValue("WEEKLY");
  await expect(page.getByLabel("Last Occurrence", { exact: false })).toHaveValue("2030-02-07");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByLabel("Repeat", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/recurring-event-${info.project.name}.png` });
});

test("editing loads the schedule and can turn recurrence off", async ({ page }) => {
  await page.goto("/event-form-edit");
  await expect(page.getByLabel("Repeat", { exact: true })).toHaveValue("WEEKLY");
  await expect(page.getByLabel("Last Occurrence", { exact: false })).toHaveValue("2030-02-07");
  await page.getByLabel("Repeat", { exact: true }).selectOption("NONE");
  await expect(page.getByLabel("Last Occurrence", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.eventSubmissions?.length || 0)).toBe(1);
  expect(await page.evaluate(() => window.eventSubmissions[0])).toMatchObject({ eventId: "fixture-event", recurrence: "NONE" });
});

test("one-time event purchases cannot select weekly recurrence", async ({ page }) => {
  await page.goto("/event-form-edit?oneTime=1");
  await expect(page.getByLabel("Repeat", { exact: true }).locator("option[value=WEEKLY]")).toBeDisabled();
  await expect(page.getByText("Weekly events require membership", { exact: false })).toBeVisible();
});

test("calendar shows the selected weekly occurrence and links to its date", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("fixtureRecurring", "1"));
  await page.goto("/events/results?date=2030-01-17");
  await expect(page.locator(".card-title")).toContainText("Weekly Open Mic");
  await expect(page.locator(".ticket .date")).toHaveText("17");
  await expect(page.locator(".ticket .time")).toHaveText("10:00 AM");
  await expect(page.locator(".card-meta")).toContainText("Every Thursday");
  await expect(page.locator(".event-card-link")).toHaveAttribute("href", "/events/0?date=2030-01-17");
});
