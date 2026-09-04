---
type: "query"
date: "2026-09-01T23:58:43.325705+00:00"
question: "ok how can wew make this feature live on the prod site and prod vercel env variables?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["role-transitions.js", "billing.js", "admin.js", "UserRoleControl()", "vercel.json"]
---

# Q: ok how can wew make this feature live on the prod site and prod vercel env variables?

## Answer

Expanded from original query via vocab: [complimentary, production, enabled, role, transition, billing, stripe, subscription, checkout, admin, vercel, deployment]. Do not enable the Vercel flags yet: current code hard-codes billingMutationFence=false and production validation rejects both BILLING_MUTATION_FENCE_ENABLED=true and any COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=true. Production enablement requires a durable account-level billing mutation fence shared by membership checkout/portal and role transitions; cleanup/verification of open account Checkout sessions; recovery UI for PARTIAL, STRIPE_VERIFIED, and NEEDS_ATTENTION operations; concurrency, crash-recovery, webhook, and rollback tests; then a flags-off production deploy and migration. After smoke testing, enable BILLING_MUTATION_FENCE_ENABLED=true in Production and redeploy, verify the fence, then enable COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=true and redeploy. Roll back grants by setting only COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=false and keep the fence enabled. Vercel CLI is linked to txlocallist but is not authenticated on this machine, so no Vercel variables were inspected or changed.

## Outcome

- Signal: useful

## Source Nodes

- role-transitions.js
- billing.js
- admin.js
- UserRoleControl()
- vercel.json