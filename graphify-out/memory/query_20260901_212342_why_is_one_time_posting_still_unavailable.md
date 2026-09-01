---
type: "query"
date: "2026-09-01T21:23:42.106493+00:00"
question: "why is one time posting still unavailable?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["isEventPostingEnabled()", "runtime-config.mjs", "page.js", "createEventCheckoutSessionInternal()"]
---

# Q: why is one time posting still unavailable?

## Answer

Expanded from original query via graph vocabulary: [event, posting, stripe, price, enabled, config, checkout, payment, feature, time]. The local dashboard shows Posting Unavailable because .env.local has EVENT_POSTING_ENABLED=false. All other local sandbox availability checks pass: development database environment matches, Stripe secret and publishable keys are test mode, the webhook signing secret is valid, and the event Price ID is configured. The earlier acceptance run set the flag true only in a temporary server process and then shut it down, so the persistent file stayed false. In production, setting the environment flag alone is not sufficient because IMPLEMENTED_CAPABILITIES.productionEventPosting is also currently false. The new-event page renders the unavailable state whenever one-time posting is disabled and the user lacks the membership-linked alternative.

## Outcome

- Signal: useful

## Source Nodes

- isEventPostingEnabled()
- runtime-config.mjs
- page.js
- createEventCheckoutSessionInternal()