---
type: "query"
date: "2026-09-17T20:43:49.148197+00:00"
question: "Fix the business results page Prisma missing-column error, rename Explore Businesses to Businesses in the new navigation, left-align the top logo on both results pages, and remove the Events & Live Music introduction from event results on mobile and desktop."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ResultsPage", "EventsResults.jsx", "ResultsExperience.jsx", "NavbarMobileMenu.jsx"]
---

# Q: Fix the business results page Prisma missing-column error, rename Explore Businesses to Businesses in the new navigation, left-align the top logo on both results pages, and remove the Events & Live Music introduction from event results on mobile and desktop.

## Answer

Added backward-compatible Prisma query fallbacks for event cities, business categories, favorites, and the business search API so older local schemas no longer crash /results. Renamed the business navigation item to Businesses, left-aligned mobile result-page logos, and removed the event-results introduction. Verified live HTTP/API responses, browser behavior, 248 unit tests, targeted mobile UI tests, lint, and the production build.

## Outcome

- Signal: useful

## Source Nodes

- ResultsPage
- EventsResults.jsx
- ResultsExperience.jsx
- NavbarMobileMenu.jsx