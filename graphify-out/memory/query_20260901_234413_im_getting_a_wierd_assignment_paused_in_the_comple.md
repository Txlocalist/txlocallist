---
type: "query"
date: "2026-09-01T23:44:13.490965+00:00"
question: "im getting a wierd assignment paused in the complementary acces on the live prod website"
contributor: "graphify"
outcome: "useful"
source_nodes: ["UserRoleControl()", "role-transitions.js", "billing.js", "isComplimentaryRoleMutationsEnabled()", "assertComplimentaryRoleMutationEnabled"]
---

# Q: im getting a wierd assignment paused in the complementary acces on the live prod website

## Answer

Expanded from original query via graph vocabulary: [complimentary, role, access, admin, user, billing, enabled, review, subscription]. The text is an intentional global rollout label, not a per-user paused assignment. UserRoleControl renders Complimentary (assignment paused) whenever isComplimentaryRoleMutationsEnabled returns false. That function requires three gates: the hard-coded billingMutationFence capability, BILLING_MUTATION_FENCE_ENABLED, and COMPLIMENTARY_ROLE_MUTATIONS_ENABLED. The hard-coded capability is currently false, so new Complimentary grants are blocked in every environment regardless of deployment variables. Existing Complimentary users retain access and can be revoked; only new grants are paused. The safety reason is that assigning Complimentary can replace/cancel linked Stripe renewal and the billing-concurrency fence plus sandbox recovery tests are not yet complete. This blocks launching the Complimentary assignment feature, but not unrelated site functionality.

## Outcome

- Signal: useful

## Source Nodes

- UserRoleControl()
- role-transitions.js
- billing.js
- isComplimentaryRoleMutationsEnabled()
- assertComplimentaryRoleMutationEnabled