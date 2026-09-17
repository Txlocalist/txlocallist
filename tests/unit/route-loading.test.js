import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Loading from "@/app/loading";
import EventsLoading from "@/app/events/loading";

describe("route loading states", () => {
  it("uses a spinner for the shared app loading boundary", () => {
    const html = renderToStaticMarkup(createElement(Loading));

    expect(html).toContain("Loading Texas Localist");
    expect(html).not.toContain("results-skeleton-card");
  });

  it("uses a dark event-shaped skeleton for event routes", () => {
    const html = renderToStaticMarkup(createElement(EventsLoading));

    expect(html).toContain('aria-label="Loading events"');
    expect(html.match(/<article/g)).toHaveLength(4);
  });
});
