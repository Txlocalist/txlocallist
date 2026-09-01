# One-Time Event Posting Launch

## Catalog decision

Keep the existing subscription product for the Local Business Membership. Use a separate Stripe product and a one-time Price for Event Calendar Post. The event product uses Stripe tax code `txcd_10701000` (Website Advertising), and its $10 Price uses exclusive tax behavior so applicable tax is added in Checkout. Separate products keep receipts, reporting, refunds, and webhook metadata unambiguous.

The catalog setup script is safe by default in test mode:

```powershell
npm run stripe:setup-catalog
```

It prints the recurring membership Price ID and the one-time event Price ID. Live catalog changes require the explicit `--allow-live` argument:

```powershell
node scripts/setup-stripe-catalog.mjs --allow-live
```

The catalog command uses the currently configured `STRIPE_PRICE_STARTER` to locate the existing membership product. Its output is authoritative for this release: record the printed $10 recurring Price ID even when it differs from the input ID.

Do not archive an old live subscription Price until the new Price is deployed, Checkout is verified, and existing subscriptions have been reconciled. Archiving a Price prevents new purchases but does not migrate existing subscriptions.

## Required production settings

```text
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PK=pk_live_...
STRIPE_PRICE_STARTER=price_...       # $10 monthly, recurring
STRIPE_PRICE_EVENT_POST=price_...    # $10 one time
STRIPE_WEBHOOK_SECRET=whsec_...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
CRON_SECRET=...                     # random value, at least 16 characters
EVENT_POSTING_ENABLED=false
```

Leave `EVENT_POSTING_ENABLED=false` until the database migration, live catalog, webhook, and end-to-end payment test are complete. Then switch it to `true` and redeploy.

## Production rollout and database deployment

Keep `EVENT_POSTING_ENABLED=false` throughout these steps.

1. Take a database snapshot and run `npx prisma migrate status`.
2. With the current live membership Price in `STRIPE_PRICE_STARTER`, create or locate the approved $10 catalog Prices:

   ```powershell
   node scripts/setup-stripe-catalog.mjs --allow-live
   ```

3. Record the two Price IDs printed by the command. Set `STRIPE_PRICE_STARTER` to the printed recurring Price and `STRIPE_PRICE_EVENT_POST` to the printed one-time Price in both the release shell and the deployment environment. For example, in the release PowerShell session:

   ```powershell
   $env:STRIPE_PRICE_STARTER = "price_recurring_from_step_2"
   $env:STRIPE_PRICE_EVENT_POST = "price_one_time_from_step_2"
   ```

   Do not redeploy or enable event posting yet.
4. If the database is nonempty but has no Prisma migration history, do not run the baseline migration directly. First compare the live schema with `20260807000000_baseline`, then mark only that baseline as applied:

   ```powershell
   npx prisma migrate resolve --applied 20260807000000_baseline
   ```

5. Before applying migrations, confirm there is no event with more than one active local Checkout attempt. A nonempty result means rollout must stop while the corresponding Stripe Sessions are reconciled or expired:

   ```sql
   SELECT "eventId", COUNT(*) AS "activeAttempts"
   FROM "EventPayment"
   WHERE "status" IN ('CREATED', 'PROCESSING')
   GROUP BY "eventId"
   HAVING COUNT(*) > 1;
   ```

6. Apply the additive migrations and regenerate the client:

   ```powershell
   npm run db:migrate
   npm run db:generate
   ```

7. Synchronize the Plan rows from the release environment. The strict flag fails if `STRIPE_PRICE_STARTER` is missing or if the stored Starter amount, interval, or Price ID does not match:

   ```powershell
   npm run db:seed-plans -- --require-stripe-prices
   ```

8. Confirm `npx prisma migrate status` reports every migration applied. Query the production database and verify the `starter` row has `priceCents = 1000`, `billingPeriod = 'monthly'`, and the exact recurring Price ID printed in step 2:

   ```sql
   SELECT "slug", "name", "tier", "priceCents", "billingPeriod", "stripePriceId"
   FROM "Plan"
   WHERE "slug" = 'starter';
   ```

9. Retrieve both Prices in Stripe (Dashboard or CLI). Confirm the Starter Price is active, USD 1000, and recurring monthly; confirm the event Price is active, USD 1000, and non-recurring. Also confirm the Stripe mode matches the deployed keys.
10. In Stripe Tax, configure the verified Texas head-office address, activate Tax, and add the active Texas sales-tax registration. Confirm the event Product has tax code `txcd_10701000` and its Price has `tax_behavior=exclusive`.
11. Redeploy with the recorded Price IDs while leaving `EVENT_POSTING_ENABLED=false`. Complete the webhook and acceptance checks below before enabling it.
12. After the live webhook endpoint is configured, run the automated read-only
    preflight described below. A passing command is evidence that the automated
    checks succeeded; it is not authorization to enable the feature.

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

## Automated read-only preflight

Run this command from the production release environment only after catalog
setup, migration deployment, Plan synchronization, and webhook configuration.
Keep `EVENT_POSTING_ENABLED=false`:

```powershell
npm run event-posting:verify-readiness -- --confirm-live-readonly
```

The acknowledgement must be supplied explicitly; the npm script does not bypass
it. The verifier performs only Stripe retrieve/list requests, database
SELECT/group queries, and local deployment-manifest reads. It does not create,
update, expire, refund, migrate, seed, or delete anything. It exits nonzero when
an automated check fails.

The verifier checks:

- Production HTTPS origin, PostgreSQL URL presence, live Stripe key modes,
  configured Price IDs and webhook secret format, Blob access, a sufficiently
  long Cron bearer secret, and the disabled feature flag.
- Active live Starter and Event Prices and products. Starter must be USD 1000
  recurring once per month; Event must be USD 1000 one-time with exclusive tax
  behavior and the Website Advertising tax code; their products must be distinct
  and carry the catalog metadata created by the setup script.
- Active live Stripe Tax settings with a Texas head office and an active live
  Texas sales-tax registration.
- An enabled live Stripe webhook at the exact
  `NEXT_PUBLIC_SITE_URL/api/stripe/webhook` URL. It must list every event in
  this runbook or use Stripe's `*` wildcard.
- The Starter Plan row, duplicate `CREATED`/`PROCESSING` EventPayment groups,
  required Prisma migration history (including the image-upload lifecycle
  migration), and the installed partial unique index.
- The local Vercel deployment manifest schedules
  `/api/event-images/cleanup` once per day.

If the Stripe key cannot list webhook endpoints, or the database role cannot
read Prisma migration history or `pg_indexes`, the verifier fails rather than
claiming readiness. Grant temporary read access or verify the failing item
through the approved operational process, then rerun it.

A zero exit code means only **automated preflight passed**. It does not prove
that `STRIPE_WEBHOOK_SECRET` belongs to the returned endpoint because Stripe
does not return signing secrets. It also does not execute a payment, exercise
webhook delivery, reconcile existing subscriptions, make a taxability
determination, prove that the local Cron manifest has reached Vercel, or complete
the acceptance test below.

**Manual launch gate:** obtain and document the client's tax-adviser approval,
then complete the full acceptance test. Do not enable event posting solely
because the automated preflight exits successfully.

## Acceptance test

1. Use Stripe test keys and enable event posting only in the sandbox process.
2. Create a one-day event and confirm hosted Checkout shows a $10 subtotal plus the applicable Texas tax.
3. Repeat with a 30-day event to exercise the maximum duration boundary and confirm the same $10 subtotal plus applicable tax. A zero tax amount is acceptable only when Stripe reports Automatic Tax as complete for the resolved customer location and the documented tax decision supports that result.
4. Complete payment with a Stripe test card while the success URL points to an unavailable local port. This proves the webhook, rather than the browser return page, performs fulfillment.
5. Confirm the payment becomes `PAID`, the event becomes `PENDING`, and the matching `StripeWebhookEvent` is processed without an error. Run the sandbox payment verifier against the event ID:

   ```bash
   npm run event-posting:verify-sandbox-payment -- --confirm-sandbox-readonly --event-id=<event-id>
   ```

   Replay the exact sandbox Stripe event against the local webhook and confirm the response reports `duplicate: true`; the receipt attempt count and event/payment state must remain unchanged:

   ```bash
   npm run stripe:webhook:replay-sandbox -- --confirm-sandbox-local-replay --event-id=<stripe-event-id> --target=http://127.0.0.1:3000/api/stripe/webhook
   ```

   Never pass a live event to the replay command. The command refuses production keys, live events, and non-loopback targets.
6. Approve it and confirm every inclusive calendar day finds the event.
7. Deny a new paid submission with a required admin comment. Confirm the payment remains `PAID`, the event returns to `DRAFT`, and the owner can see the comment, edit, and resubmit without another fee.
8. Open Checkout, cancel the draft in another tab, then attempt the stale payment. Confirm the session is expired or the late payment becomes `REVIEW_REQUIRED`; it must never trigger an automatic refund.
9. From Payment Exceptions, issue a test refund only after entering a reason and checking the explicit full-refund confirmation. Confirm Stripe refunds the subtotal and tax and the audit fields record the approving admin, time, and reason.
10. Open a dispute and confirm the event is hidden. Close it favorably and confirm it remains hidden until an admin restores it to the review queue.
11. Confirm past events disappear from search but retain their direct history page.
12. Reconcile subscriptions from Admin Settings and confirm inactive or past-due accounts do not retain posting access.

## Policy and operations

- One purchase covers one continuous event spanning 1 to 30 calendar days.
- Separate occurrences and recurring dates require separate posts.
- An admin denial requires a comment and returns the event to an editable draft. The owner may correct and resubmit the same event as many times as needed without another fee, provided its dates remain within the original purchased range.
- Refunds and dispute compensation are never automatic. The customer must contact support, and only an administrator may approve and issue a full refund. The refund includes collected tax and requires an explicit confirmation, reason, approver, and timestamp.
- Duplicate or late/ineligible payments become `REVIEW_REQUIRED`; they do not trigger an automatic refund.
- Organizer or admin cancellation does not create an automatic refund.
- Cancellation first expires any open Checkout session. If Stripe has already confirmed payment, the payment is recorded before cancellation and remains subject to the no-automatic-refund policy. An asynchronous payment still processing must settle before cancellation can finish.
- A paid event cannot be moved outside its originally purchased date range. A new date range requires a new post.
- Material edits return a published event to the review queue.
- An event paused by a payment dispute remains hidden even after a favorable resolution. An administrator must explicitly restore an eligible event to the review queue. Ended dispute-paused events remain in Payment Exceptions for an explicit support decision.
- The approved implementation uses Stripe Tax for Texas only, with tax code `txcd_10701000` (Website Advertising) and exclusive tax behavior. Keep the documented tax-adviser approval with the release record.
- Monitor `REVIEW_REQUIRED`, `REFUND_FAILED`, `REFUND_PENDING`, `DISPUTED`, and webhook rows with `lastError` as operational alerts.
