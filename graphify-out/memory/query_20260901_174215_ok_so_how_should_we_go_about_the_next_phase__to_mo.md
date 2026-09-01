---
type: "query"
date: "2026-09-01T17:42:15.491612+00:00"
question: "ok so how should we go about the next phase  to move into launch readiness?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["event-payments.js", "admin.js", "verify-event-posting-readiness.mjs", "One-Time Event Posting Launch", "event-disputes.js"]
---

# Q: ok so how should we go about the next phase  to move into launch readiness?

## Answer

Expanded from original query via graph vocab: [launch, readiness, payment, refund, dispute, admin, review, restore, webhook, stripe, reconcile, production]. The next safe phase is the sandbox Payment Exceptions lifecycle. First take read-only snapshots and verify admin-only access. Then use a disposable paid event to exercise an explicitly confirmed full refund, including tax, audit fields, event hiding, webhook convergence, and duplicate-delivery idempotency. Use a separate disposable paid event for the dispute lifecycle so the refund case and existing 30-day acceptance artifact remain isolated. Do not use generic Stripe CLI fixture events for correlated E2E validation; use a real sandbox test transaction. Keep EVENT_POSTING_ENABLED=false persistently and enable it only in the local process. After this gate, separately test subscription failure/access reconciliation, then run the live read-only preflight and operational rollout gates.

## Outcome

- Signal: useful

## Source Nodes

- event-payments.js
- admin.js
- verify-event-posting-readiness.mjs
- One-Time Event Posting Launch
- event-disputes.js