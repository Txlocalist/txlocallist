---
type: "query"
date: "2026-09-01T19:05:01.689605+00:00"
question: "ok can you refund checkpoint  testing and 30-day acceptance event, complete the refund lifecycle, and stop for review before beginning dispute testing.  "
contributor: "graphify"
outcome: "useful"
source_nodes: ["refundEventPayment", "persistEventRefund", "issueEventPaymentRefund", "handleEventRefundUpdated", "getPublicEventWhere", "issueEventPaymentRefundAction"]
---

# Q: ok can you refund checkpoint  testing and 30-day acceptance event, complete the refund lifecycle, and stop for review before beginning dispute testing.  

## Answer

Expanded from original query via graph vocab: [refund, payment, admin, event, webhook, audit, public, cancel, review, stripe]. Sandbox refund lifecycle completed for the disposable event: Stripe refund succeeded for 1000 USD cents, the payment converged to REFUNDED, the event converged to CANCELLED with PAYMENT_REFUND, audit approval fields were recorded, three refund webhook receipts processed without errors, a duplicate refund.updated replay returned duplicate=true without state changes, and the event became unavailable publicly. The separate 30-day acceptance event remained PUBLISHED with its paid payment unrefunded. Dispute testing was not started. Production was untouched and persistent event-posting flags remained false. Finding: the ordinary PAID refund control is discoverable in Published / Denied History, not Payment Exceptions, while the launch runbook says to initiate it from Payment Exceptions.

## Outcome

- Signal: useful

## Source Nodes

- refundEventPayment
- persistEventRefund
- issueEventPaymentRefund
- handleEventRefundUpdated
- getPublicEventWhere
- issueEventPaymentRefundAction