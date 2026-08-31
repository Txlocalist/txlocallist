---
type: "query"
date: "2026-08-28T17:47:20.410597+00:00"
question: "Review Admin soft-delete design for User accounts and identify correctness gaps or needed deletedAt filters."
contributor: "graphify"
outcome: "useful"
source_nodes: ["session.js", "user-deletion.js", "role-transitions.js", "billing.js", "event-payments.js", "schema.prisma"]
---

# Q: Review Admin soft-delete design for User accounts and identify correctness gaps or needed deletedAt filters.

## Answer

Expanded from original query via vocab: [user, delete, session, business, event, stripe, subscription, audit, role, application, favorite, admin]. Key findings: enforce deletedAt at session resolution to close an in-flight login/delete race; exclude deleted rows from user management, access, and role assignment while letting billing webhooks retain and safely sync billing records; do not directly cancel all events because that bypasses active Stripe Checkout cleanup and overwrites existing refund/dispute cancellation reasons; inspect open subscription Checkout sessions and schedule-managed subscriptions in addition to cancel_at_period_end; archive jobs and clarify whether website/social/applyEmail count as contact PII; local retained Stripe identifiers make this pseudonymization, not full anonymization.

## Outcome

- Signal: useful

## Source Nodes

- session.js
- user-deletion.js
- role-transitions.js
- billing.js
- event-payments.js
- schema.prisma