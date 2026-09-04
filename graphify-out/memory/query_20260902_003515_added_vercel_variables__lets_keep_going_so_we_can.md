---
type: "query"
date: "2026-09-02T00:35:15.049061+00:00"
question: "added vercel variables. lets keep going so we can push this feature live. skip test in sandbox because we already did this step."
contributor: "graphify"
outcome: "useful"
source_nodes: ["role-transitions.js", "billing.js", "admin.js", "UserRoleControl()", "vercel.json"]
---

# Q: added vercel variables. lets keep going so we can push this feature live. skip test in sandbox because we already did this step.

## Answer

Committed and pushed the production Complimentary-role safety implementation as 1339192, deployed it to txlocalist.com with rollout flags off, applied and verified the BillingMutationFence production migration, enabled only the billing fence, and redeployed successfully. Canonical health returns the new release and the fence table is reachable. Complimentary grants remain disabled pending an authenticated production Admin User Management smoke. Sandbox acceptance was intentionally skipped. EVENT_POSTING_ENABLED remains a separate production hard-gate issue.

## Outcome

- Signal: useful

## Source Nodes

- role-transitions.js
- billing.js
- admin.js
- UserRoleControl()
- vercel.json