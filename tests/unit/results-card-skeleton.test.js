import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ResultsCardSkeleton from "@/app/results/ResultsCardSkeleton";

describe("ResultsCardSkeleton", () => {
  it("renders an accessible grid of card-shaped placeholders", () => {
    const html = renderToStaticMarkup(createElement(ResultsCardSkeleton));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading businesses"');
    expect(html.match(/results-skeleton-card/g)).toHaveLength(6);
    expect(html.match(/results-skeleton-image/g)).toHaveLength(6);
    expect(html.match(/results-skeleton-arrow/g)).toHaveLength(6);
  });
});
