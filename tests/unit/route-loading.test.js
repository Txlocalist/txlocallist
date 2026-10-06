import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Loading from "@/app/loading";
import EventsLoading from "@/app/events/loading";
import EventResultsLoading from "@/app/events/results/loading";
import EventDetailLoading from "@/app/events/[id]/loading";

describe("route loading states", () => {
  it("uses a spinner for the shared app loading boundary", () => {
    const html = renderToStaticMarkup(createElement(Loading));

    expect(html).toContain("Loading Texas Localist");
    expect(html).not.toContain("results-skeleton-card");
  });

  it("uses event cards for the landing page", () => {
    const html = renderToStaticMarkup(createElement(EventsLoading));

    expect(html).toContain('aria-label="Loading happenings"');
    expect(html.match(/<article/g)).toHaveLength(4);
  });
  it("uses a results layout with a calendar placeholder", () => {
    const html = renderToStaticMarkup(createElement(EventResultsLoading));
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html.match(/<aside/g)).toHaveLength(2);
    expect(html).toContain('aria-busy="true"');
  });
  it("loads a detail hero and information panels instead of result cards", () => {
    const html = renderToStaticMarkup(createElement(EventDetailLoading));
    expect(html).toContain('aria-label="Loading happening details"');
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain('aria-hidden="true"');
  });
});
