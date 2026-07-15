---
type: "query"
date: "2026-07-15T20:13:24.315412+00:00"
question: "How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["HowItWorksPage()", "PricingPage()", "ResultsPage()"]
---

# Q: How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?

## Answer

Expanded from original query via graph vocabulary: [how, works, page, navbar, footer, image, local, pricing, results]. The saved graph identifies HowItWorksPage in src/app/how-it-works/page.js and connects the route-level page to its source module. Direct source inspection confirms the page uses the shared auth-aware Navbar and Footer, with preserved links to /pricing and /results and unchanged metadata/content.

## Outcome

- Signal: useful

## Source Nodes

- HowItWorksPage()
- PricingPage()
- ResultsPage()