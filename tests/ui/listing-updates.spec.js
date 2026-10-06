import { test, expect } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("a saved external webpage shows a recoverable photo fallback", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://www.roundrockfirefighters.org/round-rock-safety", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html><body>Existing event webpage</body></html>" }),
  );
  await page.goto("/listing-updates/event-edit?external=1&past=1");
  await expect(page.getByText("Photo preview unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByText("Photo preview unavailable")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test("happening actions fit together with consistent targets and a working delete dialog", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/listing-updates/event-actions");
  const row = page.locator('[data-label="Actions"]').first();
  const edit = row.getByRole("link", { name: /^Edit / });
  await expect(edit).toHaveText("Edit");
  await expect(edit).toHaveAttribute("href", "/dashboard/events/event-0/edit");
  for (const control of [edit, row.getByRole("link", { name: /^View / }), row.getByRole("button", { name: "Delete", exact: true })]) {
    const box = await control.boundingBox();
    const bounds = await row.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  }
  if (page.viewportSize().width >= 1100) {
    const editBox = await edit.boundingBox();
    const deleteBox = await row.getByRole("button", { name: "Delete", exact: true }).boundingBox();
    expect(Math.abs(editBox.y - deleteBox.y)).toBeLessThan(1);
  }
  await edit.focus();
  expect(await edit.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("heading", { name: "My Happenings" }).click();
  await page.screenshot({ path: `test-results/event-actions-${info.project.name}.png`, fullPage: true });
  for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(edit).toBeVisible();
    await expect(page.locator('[data-label="Date"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await expect(edit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("dashboard offers a visible edit action for an existing happening", async ({ page }, info) => {
  await page.goto("/listing-updates/dashboard?past=1");
  await expect(page.getByRole("heading", { name: "Recent Happenings" })).toBeVisible();
  const edit = page.getByRole("link", { name: /^Edit Saturday Market/ });
  await expect(edit).toBeVisible();
  await expect(edit).toHaveAttribute("href", "/dashboard/events/market/edit");
  const box = await edit.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/dashboard-edit-${info.project.name}.png`, fullPage: true });
});

test("published event form saves details and a replacement photo after upload completes", async ({
  page,
}) => {
  await page.route("**/fixtures/*.png", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  let finishUpload;
  const uploadReady = new Promise((resolve) => {
    finishUpload = resolve;
  });
  await page.route("**/api/event-images/upload", async (route) => {
    await uploadReady;
    await route.fulfill({
      json: {
        success: true,
        files: [{ url: "/fixtures/replacement.png", name: "Replacement" }],
      },
    });
  });
  await page.goto("/listing-updates/event-edit?past=1");
  await expect(page.getByText(/Published happenings stay live/)).toBeVisible();
  await page
    .getByLabel("Happening Title *", { exact: true })
    .fill("Updated Community Market");
  await page
    .getByLabel("Description *", { exact: true })
    .fill("Updated details for a fun community gathering with food and music.");
  await page.getByRole("button", { name: "Remove photo" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(
    page.getByRole("button", { name: "Uploading photo...", exact: true }),
  ).toBeDisabled();
  finishUpload();
  await expect(
    page.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.eventSubmissions?.[0]?.imageUrl))
    .toBe("/fixtures/replacement.png");
  expect(await page.evaluate(() => window.eventSubmissions[0].title)).toBe(
    "Updated Community Market",
  );
  expect(await page.evaluate(() => window.eventSubmissions[0].startDate)).toBe("2000-05-24T10:00");
  expect(await page.evaluate(() => window.eventSubmissions[0].endDate)).toBe("2000-05-24T12:00");
});

for (const variant of ["landing", "results", "detail"]) {
  test(`${variant} event loader fits the viewport and respects reduced motion`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/listing-updates/loader?variant=${variant}`);
    await expect(page.getByRole("status")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const animations = await page
      .locator('[aria-hidden="true"] div')
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node, "::after").animationName),
      );
    expect(animations.every((name) => name === "none")).toBe(true);
    await page.screenshot({
      path: `test-results/${variant}-loader-${info.project.name}.png`,
      fullPage: true,
    });
  });
}

test("business cards grow with descriptions and keep location beneath hours", async ({
  page,
}, info) => {
  await page.goto("/listing-updates/business");
  const about = page.locator('div[class*="aboutCard"]');
  const short = await about.boundingBox();
  await page.goto("/listing-updates/business?long=1");
  const long = await about.boundingBox();
  expect(long.height).toBeGreaterThan(short.height + 100);
  const hours = await page.locator('div[class*="hoursCard"]').boundingBox();
  const location = await page
    .locator('div[class*="locationCard"]')
    .boundingBox();
  expect(Math.abs(location.x - hours.x)).toBeLessThan(1);
  expect(Math.abs(location.width - hours.width)).toBeLessThan(1);
  expect(location.y - (hours.y + hours.height)).toBeLessThan(30);
  expect(location.y).toBeGreaterThan(hours.y + hours.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/business-layout-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto(
    "/listing-updates/business?unbroken=1&noHiring=1&noAddress=1",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await expect(page.getByText("Find the Spot")).toHaveCount(0);
  await expect(page.getByText("Now Hiring")).toHaveCount(0);
});
