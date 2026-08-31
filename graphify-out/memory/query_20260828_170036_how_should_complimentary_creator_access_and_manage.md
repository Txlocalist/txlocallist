---
type: "query"
date: "2026-08-28T17:00:36.103031+00:00"
question: "How should complimentary creator access and manager/admin roles be implemented?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["resolveAccountAccess", "hasStripeFeatureAccess", "syncEffectiveAccessPlans", "confirmRoleTransition", "requireStaff"]
---

# Q: How should complimentary creator access and manager/admin roles be implemented?

## Answer

Centralize effective access in resolveAccountAccess; use COMPLIMENTARY for indefinite Starter creator access, MANAGER for restricted staff moderation, and ADMIN for full administration. Keep Stripe paid status truthful and schedule recurring cancellation before granting Complimentary.

## Outcome

- Signal: useful

## Source Nodes

- resolveAccountAccess
- hasStripeFeatureAccess
- syncEffectiveAccessPlans
- confirmRoleTransition
- requireStaff