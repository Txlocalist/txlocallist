import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SearchBar from "@/components/SearchBar/SearchBar";
import EventSearchBar from "@/components/EventSearchBar/EventSearchBar";

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

  it("uses the shared event date picker without the removed local-events pill", () => {
    const html = renderToStaticMarkup(
      createElement(EventSearchBar, {
        initialLocation: "Austin, TX",
        initialDate: "next-7-days",
      })
    );

    expect(html).toContain("Next 7 Days");
    expect(html).toContain("All Dates");
    expect(html).toContain("Austin, TX");
    expect(html).not.toContain("Local Events");
  });
});
