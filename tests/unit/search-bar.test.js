import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SearchBar from "@/components/SearchBar/SearchBar";

describe("SearchBar type selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the shared type selector visible by default", () => {
    const html = renderToStaticMarkup(createElement(SearchBar));

    expect(html).toContain("Local Businesses");
    expect(html).toContain("Local Events");
  });

  it("can hide the type selector for the results-page search bar", () => {
    const html = renderToStaticMarkup(
      createElement(SearchBar, {
        showTypeSelector: false,
        visibleTypes: ["businesses"],
        variant: "inline",
      })
    );

    expect(html).not.toContain("Local Businesses");
    expect(html).not.toContain("Local Events");
    expect(html).toContain("Search");
  });
});
