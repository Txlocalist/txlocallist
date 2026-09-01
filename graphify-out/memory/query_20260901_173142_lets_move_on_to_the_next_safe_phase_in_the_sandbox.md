---
type: "query"
date: "2026-09-01T17:31:42.348127+00:00"
question: "lets move on to the next safe phase in the sandbox moderation lifecycle"
contributor: "graphify"
outcome: "useful"
source_nodes: ["event-payments.js", "events.js", "admin.js", "event-dates.js"]
---

# Q: lets move on to the next safe phase in the sandbox moderation lifecycle

## Answer

Expanded tokens: event admin approve deny review publish payment resubmit cancellation owner status dates. The graph directed review to src/lib/event-payments.js, src/lib/events.js, src/lib/admin.js, and src/lib/event-dates.js. Sandbox acceptance confirmed a 30-day paid event followed PUBLISHED, owner edit to PENDING, DENIED to DRAFT with comment, no-repurchase resubmission, and final PUBLISHED. Added deterministic integration coverage for paid-only approval, unpaid rejection, open-session cancellation expiry, paid settlement racing cancellation without automatic refund, and unresolved asynchronous payment blocking cancellation. Full test, build, schema, migration, runtime, and health gates passed.

## Outcome

- Signal: useful

## Source Nodes

- event-payments.js
- events.js
- admin.js
- event-dates.js