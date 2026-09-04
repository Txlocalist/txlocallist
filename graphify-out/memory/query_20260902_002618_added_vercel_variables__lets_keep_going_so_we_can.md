---
type: "query"
date: "2026-09-02T00:26:18.469117+00:00"
question: "added vercel variables. lets keep going so we can push this feature live. skip test in sandbox because we already did this step."
contributor: "graphify"
outcome: "useful"
source_nodes: ["role-transitions.js", "billing.js", "admin.js", "UserRoleControl()", "vercel.json"]
---

# Q: added vercel variables. lets keep going so we can push this feature live. skip test in sandbox because we already did this step.

## Answer

Implemented the production Complimentary-role billing mutation fence, open Checkout cleanup, webhook fence release, retryable Admin recovery UI, migration, feature-gate validation, and regression coverage. Automated unit/integration tests, lint, build, and health smoke passed without a sandbox replay. Production rollout must keep Complimentary grants off until the BillingMutationFence migration is applied, then deploy and verify the fence before enabling grants. EVENT_POSTING_ENABLED remains independently blocked by its production hard gate.

## Outcome

- Signal: useful

## Source Nodes

- role-transitions.js
- billing.js
- admin.js
- UserRoleControl()
- vercel.json