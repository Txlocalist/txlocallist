---
type: "query"
date: "2026-08-31T21:58:30.009077+00:00"
question: "lets move on to the next phase. i did add the new DB keys and sandbox stripe keys in the the local.env. the only thing i did not add is a webhook. i need to know how we should set that up"
contributor: "graphify"
outcome: "useful"
source_nodes: ["syncEventPaymentFromCheckoutSession()", "handleEventCheckoutSessionProcessing()", "event-payments.js"]
---

# Q: lets move on to the next phase. i did add the new DB keys and sandbox stripe keys in the the local.env. the only thing i did not add is a webhook. i need to know how we should set that up

## Answer

Expanded from the original query via graph vocabulary: stripe, webhook, signature, secret, checkout, session, payment, event, subscription, process, status, published. The existing POST /api/stripe/webhook route verifies Stripe's raw signed body and uses durable event-ID idempotency. Sandbox hardening aligned Prisma and mutation scripts with Next.js .env.local precedence, added a fail-closed Stripe CLI listener and configuration check, sanitized signature error logging, added route-level signed-event tests, documented distinct local and Preview signing secrets, and verified first-delivery plus duplicate replay against the sandbox database. The remaining external step is to install/login to Stripe CLI, run npm run stripe:webhook:listen, copy its whsec_ secret into .env.local, restart Next.js, and run npm run stripe:webhook:check. Event posting remains disabled.

## Outcome

- Signal: useful

## Source Nodes

- syncEventPaymentFromCheckoutSession()
- handleEventCheckoutSessionProcessing()
- event-payments.js