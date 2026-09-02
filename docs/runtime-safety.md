# Runtime safety controls

TX Localist uses an explicit deployment class and fail-closed admission checks so unfinished payment and role paths cannot be enabled accidentally.

## Environment separation

- Local development, tests, and Vercel Preview must use a non-production database. When Stripe is configured or exercised there, use test-mode keys; otherwise leave its credentials empty.
- `TX_LOCALIST_DATABASE_ENV` must match the runtime deployment class. This explicit marker prevents an unclassified database from passing validation; it does not independently prove which remote database a URL reaches, so provisioning and reviewing the non-production database remains a required Phase 0B step.
- Production must provide both `DATABASE_URL` for the application and `DATABASE_URL_UNPOOLED` for migrations. They must resolve to the same logical PostgreSQL database.
- Production must use matching Stripe live-mode secret and publishable keys. Every other environment rejects live-mode Stripe keys.
- Never copy production secrets into GitHub Actions. CI uses disposable PostgreSQL and explicitly empty external-service credentials so accidental Stripe, Blob, or email calls fail before reaching a provider.

Run `npm run env:verify` in local, test, or preview environments. Run `npm run env:verify:production` only in a protected deployment job after production environment variables have been loaded.

The public `/api/health` endpoint is liveness-only. It returns a status and release identifier but never configuration details, secret status, or database data.

## Initial rollout controls

Two controls are enforced at their action points:

- Event posting remains off in production. In a non-production environment it also requires matching database classification, Stripe test keys, a signed-webhook secret, and an event Price ID.
- New Complimentary grants require both the durable billing mutation fence and the Complimentary rollout switch. Revocation and recovery of possibly side-effecting operations remain available when new grants are paused.

The remaining names are reserved for later phases and currently have no runtime consumer. Configuration validation requires them to remain at their safe defaults; they must not be treated as implemented controls:

- `SUBSCRIPTION_INVOICE_EVENTS_ENABLED=false`
- `PAST_DUE_ACCESS_ENABLED=false`
- `EVENT_PAYMENT_RECONCILIATION_MODE=off`
- All v2 upload/read switches remain `false`.
- `RESUME_RETENTION_DELETE_ENABLED=false`

`RATE_LIMIT_MODE` and `CSP_MODE` are also reserved; enforcement is rejected until those implementations land. `LEGACY_BLOB_PROXY_ENABLED` must remain `true` because the legacy path is still active.

`BILLING_MUTATION_FENCE_ENABLED` may be enabled independently to activate account-level serialization without allowing new Complimentary grants. `COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=true` is accepted only when that fence is also enabled. Administrators can revoke existing Complimentary access regardless of the grant switch, and any operation that could have reached Stripe remains visible and retryable by an Admin after a reload.

## Release discipline

1. Merge and observe the guardrails while every new behavior switch remains off.
2. Configure isolated Preview resources and verify the signed Stripe test webhook.
3. Enable one behavior for named internal accounts where supported.
4. Observe its phase-specific acceptance window.
5. Roll back behavior by disabling its enforced control and shipping a forward fix. This guardrail release is the rollback floor: reverting below it would remove enforcement and can re-enable an unsafe legacy path.

For the first Complimentary-role production release, ordering is mandatory:

1. Deploy the code with both `BILLING_MUTATION_FENCE_ENABLED=false` and `COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=false`.
2. Apply the `20260901000000_billing_mutation_fence` migration to the production database with the direct/unpooled connection.
3. Set only `BILLING_MUTATION_FENCE_ENABLED=true`, redeploy, and verify account Checkout, billing-portal creation, the Stripe webhook, and Admin User Management load successfully.
4. Set `COMPLIMENTARY_ROLE_MUTATIONS_ENABLED=true` and redeploy. Disable only this switch to pause new grants without disabling recovery.

Do not enable the fence before its table exists. Vercel's current build runs `prisma generate` but does not run `prisma migrate deploy` automatically.

The initial CI dependency audit is informational because the repository already contains known findings. Dependency upgrades and a zero-high-vulnerability gate belong to their own reviewed release.

Use the step-by-step [Stripe sandbox webhook guide](./stripe-sandbox-webhooks.md) for local forwarding and a persistent Preview destination. Local CLI, Preview, and Production destinations each have a distinct signing secret.

## Current boundary

This CI workflow is scaffolding until it has passed on `main`. The existing production deployment still runs independently and does not yet invoke `env:verify:production`; making deployment depend on CI plus a protected production environment is the next release, not part of this guardrail release.

CI applies the migration chain to disposable PostgreSQL and checks schema drift. The health smoke test is intentionally database-free, and the application runtime still uses the Neon adapter, so this release does not claim a real runtime-database integration test.
