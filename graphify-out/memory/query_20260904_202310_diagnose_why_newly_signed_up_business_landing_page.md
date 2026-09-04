---
type: "query"
date: "2026-09-04T20:23:10.446332+00:00"
question: "Diagnose why newly signed-up business landing pages opened from Explore return a server error."
contributor: "graphify"
outcome: "useful"
source_nodes: ["BusinessDetailPage()", "page.js", "ResultsExperience.jsx"]
---

# Q: Diagnose why newly signed-up business landing pages opened from Explore return a server error.

## Answer

Expanded from original query via graph vocab: [business, businesses, detail, explore, signup, slug, listing, public, page, route, server]. Production Vercel logs show app Static to Dynamic Error for multiple /business/[slug] paths because BusinessDetailPage is configured for ISR with revalidate=3600 and generateStaticParams, but calls getCurrentUser, which reads cookies. Explore builds the correct /business/{slug} link, so signup data and slug generation are not the cause. The regression was introduced when likes/favorites added session-aware rendering while retaining static generation. Corrective options: make the route force-dynamic, or preserve ISR by moving personalized save/like state out of the static server render.

## Outcome

- Signal: useful

## Source Nodes

- BusinessDetailPage()
- page.js
- ResultsExperience.jsx