---
type: "query"
date: "2026-09-09T22:03:30.919931+00:00"
question: "Why is the live production results page failing with error 4151966855?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ResultsPage()", "prisma.js"]
---

# Q: Why is the live production results page failing with error 4151966855?

## Answer

Expanded graph vocabulary: results search prisma migration business event. Graph located ResultsPage and Prisma dependencies; current source and runtime logs provide the diagnosis. Live release ec9a4c4 returns HTTP 500 for /results and /api/search. Authenticated Vercel production logs confirm digest 4151966855 is Prisma P2022 ColumnNotFound in category.findMany; event.findMany and business.count fail likewise. Current listing-visibility queries require Business.deletedAt and Event.deletedAt; migration 20260910000000_listing_soft_deletion adds these plus sortName fields. Development schema inspection and read-only Prisma queries confirm these columns are absent there too. Production exact column metadata was not obtained. Required remedy is to verify/apply production migrations using the migration-first release runbook, then recheck live routes. Investigation only: no application source changes, database migrations, or deployments performed.

## Outcome

- Signal: useful

## Source Nodes

- ResultsPage()
- prisma.js