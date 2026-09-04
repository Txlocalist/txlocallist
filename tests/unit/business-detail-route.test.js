import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  new URL("../../src/app/business/[slug]/page.js", import.meta.url),
  "utf8",
);

describe("business detail route rendering", () => {
  it("stays dynamic while rendering session-specific engagement state", () => {
    expect(routeSource).toContain('export const dynamic = "force-dynamic"');
    expect(routeSource).toContain("getCurrentUser()");
    expect(routeSource).not.toContain("export const revalidate");
    expect(routeSource).not.toContain("export const dynamicParams");
    expect(routeSource).not.toContain("generateStaticParams");
  });
});
