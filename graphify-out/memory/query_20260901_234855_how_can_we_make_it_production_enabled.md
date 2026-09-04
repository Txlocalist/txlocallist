---
type: "query"
date: "2026-09-01T23:48:55.052884+00:00"
question: "how can we make it production enabled"
contributor: "graphify"
outcome: "useful"
source_nodes: ["role-transitions.js", "billing.js", "UserRoleControl()", "AdminUsersPage()", "isComplimentaryRoleMutationsEnabled()", "validateRuntimeConfiguration()"]
---

# Q: how can we make it production enabled

## Answer

Expanded from original query via graph vocabulary: [complimentary, role, billing, enabled, production, transition, operation, stripe, admin, subscription, cancel, concurrency]. Production enablement must not be done by flipping flags alone. Existing code already provides preview/confirm, durable RoleTransitionOperation records, per-target active operation uniqueness, roleVersion stale checks, Stripe idempotency, cancellation verification, audit logging, and retryable partial states. The real missing billing mutation fence is coordination between an active Complimentary transition and membership billing mutations: createStripeCheckoutSession and portal creation do not consult activeTargetKey, and webhook/upsert paths do not fence a subscription created between final discovery and role commit. Also UserRoleControl stores the operation ID only in client state, while AdminUsersPage does not query active operations, so a partial/STRIPE_VERIFIED operation cannot be resumed after reload even though the backend supports recovery. Safe phases: implement a durable per-user billing fence and conditional operation claims; block or resolve checkout/portal during the fence and make webhooks attach/cancel late subscriptions; add a durable recovery UI; add database integration, concurrency, webhook, partial-failure, restart, and E2E tests; run sandbox scenarios with production flags false; then set billingMutationFence capability true, remove the reserved-flag rejection, make runtime validation conditional, deploy with both flags false, verify production migrations/config, and finally enable BILLING_MUTATION_FENCE_ENABLED plus COMPLIMENTARY_ROLE_MUTATIONS_ENABLED for a monitored canary. Rollback disables new grants but cannot undo already scheduled Stripe cancellations.

## Outcome

- Signal: useful

## Source Nodes

- role-transitions.js
- billing.js
- UserRoleControl()
- AdminUsersPage()
- isComplimentaryRoleMutationsEnabled()
- validateRuntimeConfiguration()