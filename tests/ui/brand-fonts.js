import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Use the app's locally built fonts for visual checks when a build is available.
export async function loadBrandFonts(page) {
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

