---
type: "query"
date: "2026-08-11T18:35:02.631821+00:00"
question: "Add a beautiful skeleton loader for the results page that looks like the cards."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ResultsExperience.jsx", "LoaderIcon()", "BusinessCard()"]
---

# Q: Add a beautiful skeleton loader for the results page that looks like the cards.

## Answer

Expanded from graph vocab: [results, loader, skeleton, card, search, businesses, experience]. ResultsExperience.jsx previously rendered LoaderIcon plus SEARCHING text. It now renders ResultsCardSkeleton.jsx, a six-card accessible placeholder grid mirroring the result card image, badge, title, description, engagement actions, and arrow. globals.css supplies warm retro shimmer styling, staggered animation, responsive grid reuse, and a reduced-motion fallback.

## Outcome

- Signal: useful

## Source Nodes

- ResultsExperience.jsx
- LoaderIcon()
- BusinessCard()