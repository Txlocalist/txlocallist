# Stripe sandbox webhooks

The application receives both subscription and one-time event payment updates at `POST /api/stripe/webhook`. Stripe signs every delivery. The endpoint verifies the unmodified request body before it writes a webhook receipt or changes billing data.

Keep `EVENT_POSTING_ENABLED=false` during setup. Webhook processing stays available for recovery, refunds, disputes, and subscription updates, but no new event Checkout can be created until a later acceptance phase.

## Local environment

Use `.env.local`; Next.js does not load a file named `local.env`. At minimum, the local classifications and URL should be:

```dotenv
TX_LOCALIST_ENV="development"
TX_LOCALIST_DATABASE_ENV="development"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
EVENT_POSTING_ENABLED="false"
```

The database must be a non-production Neon branch. Stripe keys must be from the selected Stripe sandbox and start with `sk_test_` and `pk_test_`. Never copy live keys or a production webhook secret into `.env.local`.

Run the configuration gate before starting the app:

```powershell
npm run env:verify
```

## Install and authenticate Stripe CLI

On Windows, Stripe officially supports its Scoop bucket:

```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
stripe login
```

If Scoop is unavailable, download the versioned Windows archive from Stripe's
official GitHub release, verify it against the published Windows checksum, and
place `stripe.exe` in a user-local directory on `PATH`. Complete the browser
login against the intended Stripe sandbox. The CLI is an external tool and is
not installed by this repository.

## Forward signed events locally

Start Next.js in one terminal:

```powershell
npm run dev
```

In a second terminal, start the repository's fail-closed listener:

```powershell
npm run stripe:webhook:listen
```

The command refuses production or live-mode Stripe configuration, restricts forwarding to the loopback webhook route, and subscribes only to the events handled by the application. Stripe CLI prints a `whsec_...` signing secret. Put that value in `.env.local`:

```dotenv
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Restart Next.js after changing the environment file, keep the listener running, and verify the effective configuration:

```powershell
npm run stripe:webhook:check
```

The listener's secret is specific to that forwarding destination. It is not the Stripe API key and must not be reused for a deployed Preview endpoint.

For a transport-only smoke test, run `stripe trigger checkout.session.completed` in a third terminal and confirm a `200` delivery in the listener. The generated fixture has no TX Localist `metadata.scope`, so the application intentionally records it without changing a subscription or event. A full business-flow test must use a Checkout Session created by this application.

## Deployed Preview or staging

Use a stable non-production hostname instead of a transient deployment URL. In the selected Stripe sandbox, create an Account webhook destination using snapshot events and target:

```text
https://your-staging-host.example/api/stripe/webhook
```

Subscribe to:

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

Store that destination's separate signing secret as `STRIPE_WEBHOOK_SECRET` in the Vercel Preview/staging environment only, then redeploy. Stripe must be able to reach this path; deployment protection must explicitly allow webhook traffic.

Do not add invoice events yet. Direct `invoice.payment_failed`/`invoice.paid` processing belongs to the later subscription-lifecycle phase and its rollout switch remains disabled.

## What this phase proves

A successful signed delivery proves transport, signature verification, and webhook receipt idempotency. It does not prove the 30-day event purchase flow. That later test also requires sandbox Starter and Event Price IDs, current database migrations, an app-created Checkout Session, and assertions against the resulting payment and event records.

Official references: [Stripe webhook setup](https://docs.stripe.com/webhooks), [Stripe CLI development setup](https://docs.stripe.com/get-started/development-environment), and [Stripe signature troubleshooting](https://docs.stripe.com/webhooks/signature).
