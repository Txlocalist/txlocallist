import { test, expect } from "@playwright/test";

for (const route of ["/event-form", "/event-form-edit"]) {
  test(`category and tag label taps persist through submission on ${route}`, async ({ page, isMobile }) => {
    const activate = (locator) => isMobile ? locator.tap() : locator.click();
    await page.goto(route);
    await activate(page.getByRole("button", { name: "Remove Live Music", exact: true }));

    for (const { label, option, searchLabel } of [
      { label: "Happening Categories", option: "Family Friendly", searchLabel: "Search happening categories" },
      { label: "Tags", option: "Free Admission", searchLabel: "Search tags" },
    ]) {
      const group = page.getByRole("group", { name: label, exact: true });
      const trigger = group.getByRole("button", { name: `Choose ${label.toLowerCase()}`, exact: true });
      await activate(trigger);
      await group.getByLabel(searchLabel, { exact: true }).fill(option);
      // Tap the label text, as a finger would, rather than checking the input directly.
      await activate(group.getByText(option, { exact: true }));
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(group.getByRole("checkbox", { name: option, exact: true })).toBeChecked();

      // Dismissing a mobile keyboard can blur the search with no focus destination.
      await group.getByLabel(searchLabel, { exact: true }).focus();
      await group.getByLabel(searchLabel, { exact: true }).evaluate((input) => input.blur());
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await activate(group.getByRole("button", { name: "Done", exact: true }));
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(group.getByRole("button", { name: `Remove ${option}`, exact: true })).toBeVisible();
    }

    // Outside taps and keyboard navigation must still dismiss an open picker.
    const categories = page.getByRole("button", { name: "Choose happening categories", exact: true });
    await activate(categories);
    await activate(page.getByRole("heading", { name: "Happening Details", exact: true }));
    await expect(categories).toHaveAttribute("aria-expanded", "false");
    await categories.focus();
    await categories.press("Enter");
    const categorySearch = page.getByLabel("Search happening categories", { exact: true });
    await categorySearch.fill("Family Friendly");
    await categorySearch.press("Tab");
    await page.getByRole("checkbox", { name: "Family Friendly", exact: true }).press("Tab");
    await page.getByRole("button", { name: "Done", exact: true }).press("Tab");
    await page.getByRole("button", { name: "Remove Family Friendly", exact: true }).press("Tab");
    await expect(page.getByLabel("Happening Title *", { exact: true })).toBeFocused();
    await expect(categories).toHaveAttribute("aria-expanded", "false");

    await activate(page.getByRole("button", { name: route.endsWith("edit") ? "Save Changes" : "Continue", exact: true }));
    await expect.poll(() => page.evaluate(() => window.eventSubmissions?.[0]?.categoryIds)).toEqual(["event-Family Friendly"]);
    expect(await page.evaluate(() => window.eventSubmissions[0].tags)).toBe("Free Admission");
  });
}

test("organizers search categories, choose three, and keep selections after validation", async ({ page }, info) => {
  await page.addInitScript(() => { window.eventSubmissionError = "Please review your event details."; });
  await page.goto("/event-form");
  const trigger = page.getByRole("button", { name: "Choose happening categories", exact: true });
  const search = page.getByLabel("Search happening categories", { exact: true });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Remove Live Music", exact: true })).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("checkbox", { name: "Live Music", exact: true })).toBeChecked();
  await search.fill("Family");
  await page.getByRole("checkbox", { name: "Family Friendly", exact: true }).check();
  await search.fill("Food");
  await page.getByRole("checkbox", { name: "Food & Drink", exact: true }).check();
  await search.fill("Outdoor");
  await expect(page.getByRole("checkbox", { name: "Outdoor", exact: true })).toBeDisabled();
  await expect(page.getByText("3/3 selected", { exact: true })).toBeVisible();
  await search.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Remove Family Friendly", exact: true }).click();
  await trigger.click();
  await search.fill("Outdoor");
  await page.getByRole("checkbox", { name: "Outdoor", exact: true }).check();
  await search.press("Escape");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please review your event details.");
  expect(await page.evaluate(() => window.eventSubmissions[0].categoryIds)).toEqual(["event-Live Music", "event-Food & Drink", "event-Outdoor"]);
  await expect(page.getByRole("button", { name: "Remove Live Music", exact: true })).toBeVisible();
  await expect(page.getByText("3/3 selected", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await trigger.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/event-categories-${info.project.name}.png` });
});

test("tags offer a filtered checkbox list and explicit custom tag additions", async ({ page }, info) => {
  await page.goto("/event-form-edit");
  const group = page.getByRole("group", { name: "Tags", exact: true });
  const trigger = page.getByRole("button", { name: "Choose tags", exact: true });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(group.getByRole("checkbox", { name: "Event Category: Community", exact: true })).toHaveCount(0);
  await group.getByLabel("Search tags", { exact: true }).fill("free");
  await group.getByRole("checkbox", { name: "Free Admission", exact: true }).check();
  await expect(group.getByRole("checkbox")).toHaveCount(1);
  await group.getByLabel("Search tags", { exact: true }).fill("Picnic");
  await expect(group.getByText("No matches found. Try another search.", { exact: true })).toBeVisible();
  await group.getByRole("button", { name: "Add “Picnic”", exact: true }).click();
  await expect(group.getByRole("checkbox", { name: "Picnic", exact: true })).toBeChecked();
  await group.getByLabel("Search tags", { exact: true }).fill("Family");
  await group.getByRole("checkbox", { name: "Family", exact: true }).check();
  await group.getByLabel("Search tags", { exact: true }).press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await group.getByLabel("Search tags", { exact: true }).fill("free");
  await expect(group.getByRole("checkbox", { name: "Free Admission", exact: true })).toBeChecked();
  await group.getByLabel("Search tags", { exact: true }).press("Escape");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.eventSubmissions?.[0]?.tags)).toBe("Free Admission, Picnic, Family");
  await group.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/event-tags-${info.project.name}.png` });
});
