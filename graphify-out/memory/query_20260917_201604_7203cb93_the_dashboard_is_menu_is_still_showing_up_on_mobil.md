---
type: "query"
date: "2026-09-17T20:16:04.232183+00:00"
question: "the dashboard is menu is still showing up on mobile nd the haburger nav menu is still not showing up on the right"
contributor: "graphify"
outcome: "useful"
source_nodes: ["EventsLanding.jsx", "EventsResults.jsx"]
---

# Q: the dashboard is menu is still showing up on mobile nd the haburger nav menu is still not showing up on the right

## Answer

Expanded from original query via graph vocabulary: [dashboard, shell, mobile, menu, header, navigation, results]. The events mobile headers were the relevant implementation path. Hid the standalone Dashboard or Login action at mobile widths, placed the hamburger at the right edge on both EventsLanding and EventsResults, kept the brand centered, and made the results drawer open from the right. Added Playwright coverage for the responsive behavior.

## Outcome

- Signal: useful

## Source Nodes

- EventsLanding.jsx
- EventsResults.jsx