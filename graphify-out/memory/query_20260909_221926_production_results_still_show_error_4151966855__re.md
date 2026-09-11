---
type: "query"
date: "2026-09-09T22:19:26.546234+00:00"
question: "Production results still show error 4151966855; repair the missing migration."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ResultsPage()", "prisma.js"]
---

# Q: Production results still show error 4151966855; repair the missing migration.

## Answer

Production repair completed 2026-09-09 22:18 UTC. A staged Vercel build confirmed production database identity and the sole pending migration 20260910000000_listing_soft_deletion. .env has the verified production connection; .env.local has a different development target and ordinary command precedence masks this. Created and catalog-verified full PostgreSQL17 backup in ignored .vercel/backups/production-before-results-repair-20260909.dump. Applied prisma migrate deploy with explicit verified production URLs and Node22.23.2. Verified deletion columns and generated sortName fields. Live /results, /events/results, /api/search (az/newest), and /api/events return 200; six public businesses. Live release stays 1f10b3f0ae10. Restored the project default alias to its original app deployment and removed the diagnostic deployment. Never mark migration applied merely because the build succeeds.

## Outcome

- Signal: useful

## Source Nodes

- ResultsPage()
- prisma.js