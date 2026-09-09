---
type: "code-navigation"
date: "2026-09-09T20:43:48.560947+00:00"
question: "Where are the Ambassador Circle graphic and Suggest a Business feature connected to the dashboard and results pages?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src/app/dashboard/OverviewContent.jsx", "src/app/results/ResultsExperience.jsx", "src/app/suggest-business/page.js"]
---

# Q: Where are the Ambassador Circle graphic and Suggest a Business feature connected to the dashboard and results pages?

## Answer

The Ambassador Circle was rendered by the shared dashboard OverviewContent component with styles in overview.module.css. Suggest a Business was implemented as a standalone app route and linked from ResultsExperience empty states and trust strip. Removed the shared dashboard panel, its dead styles, all results links/copy, and the route files.

## Outcome

- Signal: useful

## Source Nodes

- src/app/dashboard/OverviewContent.jsx
- src/app/results/ResultsExperience.jsx
- src/app/suggest-business/page.js