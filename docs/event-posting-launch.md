# One-Time Event Posting Launch

## Catalog decision

Keep the existing subscription product for the Local Business Membership. Use a separate Stripe product and a one-time Price for Event Calendar Post. Separate products keep receipts, reporting, refunds, and webhook metadata unambiguous.

The catalog setup script is safe by default in test mode:

```powershell
npm run stripe:setup-catalog
```

It prints the recurring membership Price ID and the one-time event Price ID. Live catalog changes require the explicit `--allow-live` argument:

```powershell
node scripts/setup-stripe-catalog.mjs --allow-live
```

Do not archive an old live subscription Price until the new Price is deployed, Checkout is verified, and existing subscriptions have been reconciled. Archiving a Price prevents new purchases but does not migrate existing subscriptions.

## Required production settings

```text
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PK=pk_live_...
STRIPE_PRICE_STARTER=price_...       # $10 monthly, recurring
STRIPE_PRICE_EVENT_POST=price_...    # $10 one time
STRIPE_WEBHOOK_SECRET=whsec_...
EVENT_POSTING_ENABLED=false
```

Leave `EVENT_POSTING_ENABLED=false` until the database migration, live catalog, webhook, and end-to-end payment test are complete. Then switch it to `true` and redeploy.

## Database deployment

1. Take a database snapshot.
2. Run `npx prisma migrate status`.
3. If the database is nonempty but has no Prisma migration history, do not run the baseline migration directly. First compare the live schema with `20260807000000_baseline`, then mark only that baseline as applied:

   ```powershell
   npx prisma migrate resolve --applied 20260807000000_baseline
   ```

4. Apply the additive migrations:

   ```powershell
   npm run db:migrate
   npm run db:generate
   ```

5. Confirm `npx prisma migrate status` reports every migration applied.

Never use `prisma db push` for this production rollout.

## Stripe webhook

Create a Stripe webhook endpoint at:

```text
https://your-production-domain.example/api/stripe/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `refund.created`
- `refund.updated`
- `refund.failed`

Use the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`. The route verifies the raw signed payload and stores each Stripe event ID before processing it.

For local webhook testing:

```powershell
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Copy the temporary `whsec_...` value printed by the CLI into the local environment before starting the app.

## Acceptance test

1. Use Stripe test keys and enable event posting.
2. Create a one-day event and confirm hosted Checkout shows exactly $10.
3. Repeat with a five-day event and confirm the same $10 total.
4. Complete payment with a Stripe test card.
5. Confirm the payment becomes `PAID` and the event becomes `PENDING`, never public before review.
6. Approve it and confirm every inclusive calendar day finds the event.
7. Deny a new paid submission and confirm every successful charge attempt is fully refunded.
8. Open Checkout, cancel the draft in another tab, then attempt the stale payment. Confirm the session is expired or the late charge is automatically refunded.
9. Confirm past events disappear from search but retain their direct history page.
10. Reconcile subscriptions from Admin Settings and confirm inactive or past-due accounts do not retain posting access.

## Policy and operations

- One purchase covers one continuous event spanning 1 to 31 calendar days.
- Separate occurrences and recurring dates require separate posts.
- First-time submissions denied before publication and duplicate charges receive full refunds.
- Organizer cancellation does not create an automatic refund.
- Cancellation first expires any open Checkout session. If Stripe has already confirmed payment, the payment is recorded before cancellation and remains subject to the no-automatic-refund policy. An asynchronous payment still processing must settle before cancellation can finish.
- A paid event cannot be moved outside its originally purchased date range. A new date range requires a new post.
- Material edits return a published event to the review queue.
- An event paused by a payment dispute returns to admin review after a favorable resolution when its schedule is still active. Ended dispute-paused events appear in Payment Exceptions for an explicit refund decision.
- Confirm sales-tax treatment with the client's accountant before enabling Stripe Tax. The application does not make a taxability determination.
- Monitor `REFUND_FAILED`, `REFUND_PENDING`, `DISPUTED`, and webhook rows with `lastError` as operational alerts.
