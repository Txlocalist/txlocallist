# Weekly recurring events

## Organizer behavior

Create or edit a membership event and choose **Repeat → Every week**. The first
occurrence sets the weekday, start time, end time, and venue time zone. An
optional **Last Occurrence** date must use that same weekday; blank means the
series continues indefinitely. Each occurrence must finish before the next
week begins. Overnight events are supported.

The series is one Event record: the URL, photos, reviews, likes, and saves are
shared. Edits apply to the whole series and published edits return to review.
Organizers can disable recurrence by choosing **Does not repeat** and entering
a future single-event range. Canceling/deleting the listing stops the series.
Individual skipped dates, daily/monthly rules, and per-occurrence editing are
not part of this first version.

Recurring posts require the existing membership entitlement and a linked active
business. Existing Complimentary and staff creator privileges are preserved.
One-time purchases cannot become weekly series (enforced by server actions and
a database constraint).

## Discovery and subscription access

Occurrence dates are calculated on read, with no weekly duplicate records or
cron job. Public cards and the detail page roll forward to the next occurrence.
The calendar receives at most 54 upcoming occurrences per series, roughly one
year, on each page load. Calendar links include `?date=YYYY-MM-DD` to open the
selected occurrence. Likes/saves still use the series ID.

Weeks are calculated in Central or Mountain local time to preserve start/end
times across daylight saving. A week whose scheduled time does not exist during
spring-forward is skipped rather than silently moved to another time.

Public visibility uses the shared creator/subscription predicates on every
request, including detail pages and engagement endpoints. `PAST_DUE`, `UNPAID`,
`INCOMPLETE`, `PAUSED`, `EXPIRED`, and `CANCELED` do not grant subscription access.
The existing paid-through cancellation policy is retained: a scheduled
cancellation remains eligible until `currentPeriodEnd`, then loses access even
if a final webhook is delayed. Complimentary/staff entitlements remain valid.

Hidden series are retained for the owner. Payment recovery restores discovery
only when the event is still published, not deleted, and its linked business is
eligible; billing never overrides moderation.

The webhook now reconciles `invoice.payment_failed` and `invoice.paid` as well
as existing subscription lifecycle events. It retrieves current subscription
state from Stripe to avoid applying stale invoice snapshots out of order.

## Rollout — migration before application deployment

1. Verify the intended production database and normal backup/recovery readiness.
2. Apply `20260912000000_weekly_recurring_events` through the normal reviewed
   Prisma migration workflow (`npm run db:migrate` with production configuration).
   It adds `recurrence` (default `NONE`) and nullable `recurrenceUntil`, a check
   constraint, and an index. Existing events remain non-recurring.
3. Ensure the production Stripe webhook subscribes to `invoice.payment_failed`
   and `invoice.paid`, in addition to the existing required events. Run
   `npm run release:check -- --env-file=<explicit-production-env-file>` before
   deployment. The older `stripe:webhook:check` command is sandbox-only and
   must not be used to certify production.
4. Build on Vercel with production secrets; the remote build runs the release
   gate and generates the Prisma client. Stage with `--prod --skip-domain`
   before promotion when performing a manual release.
5. Smoke-test a weekly membership event, approval, edit, calendar date link,
   and result filtering. Use sandbox billing to test failure/recovery, not
   an actual customer's payment.

Do not deploy application code before the migration: shared public queries now
reference these columns. Existing code is compatible with the additive migration.
No production migration or deployment was performed during implementation.

## Production preparation — September 11, 2026

The initial read-only check against the previously verified production database found
only `20260912000000_weekly_recurring_events` pending. The matching enabled live
Stripe endpoint lacked `invoice.payment_failed` and `invoice.paid`. The saved
production `.env` also lacked `TX_LOCALIST_DATABASE_ENV=production`; confirm/set
  that marker on the independently verified Vercel production database config.
Protected secrets stay in Vercel; the remote build verifies the actual values.
Do not copy `.env.local` to production:
it belongs to a different development database with Stripe test keys.

Use Node 22 (`.nvmrc`); the default local terminal currently runs Node 24.
Historical checksum differences were checked and are newline-only; this release
does not edit old migration SQL or rewrite production migration history. The
release checker verifies applied/pending/failed migration state plus recurrence
columns and constraint, not a complete production schema-drift audit.

The GitHub deployment workflow now waits for successful CI on a same-repository
`main` push, checks out that exact tested SHA, refuses a superseded release, and
runs the read-only production gate inside the remote Vercel build before promotion. CI now also runs
the isolated PostgreSQL listing suite and desktop/mobile component checks.
No automatic production migration was added. After separately applying the
backed-up migration and updating the endpoint, rerun CI for the current main SHA
to trigger deployment. Deployment no longer downloads production secrets or
runs demo seeding on every release. Existing seeded records are unchanged;
any future seed operation is separate and explicitly authorized.

Before merging, configure required reviewers on the GitHub `production`
environment as appropriate for the release owner. That GitHub account setting
was not inspected or changed. `vercel.json` disables native Git deployment for
`main` so it cannot race the CI-gated GitHub workflow; previews remain enabled.
The remote build gate also covers manual CLI production builds. Configure
`TX_LOCALIST_DATABASE_ENV=production` in Vercel, not the sandbox flag
`SUBSCRIPTION_INVOICE_EVENTS_ENABLED` (still reserved). The new signed invoice
handlers reconcile billing without that reserved switch.

The check never writes to PostgreSQL or Stripe and never prints credentials.
It checks endpoint configuration, not whether Vercel's deployed signing secret
matches Stripe; signed delivery still needs a smoke test. Keep backups private
and outside Git. Rollback must retain recurrence-aware access/date guards once
weekly records exist; prefer a forward fix over deploying the old date-only code.

After deployment, verify `/api/health` identifies the intended commit, then check
`/results`, `/events/results`, and `/api/events` for successful responses. Use an
internal membership account to create/approve a weekly event and verify its next
date and a later calendar-date link. Test failed payments only in Stripe sandbox.

## Verification

- Migration applied to a fresh disposable local PostgreSQL database,
  `txlocalist_listing_test`, using all existing migrations.
- Database integration tests cover create/edit/approval after the first week,
  one-time purchase rejection, hiding/recovery across billing states, cancellation
  period boundary, specific occurrence detail links, and pagination merging
  recurring and single-event dates without duplicates.
- Unit tests cover timezone/DST transitions, overnight ranges, final occurrences,
  historical anchors, invalid rules/dates, and bounded expansion.
- Desktop/mobile browser tests cover form submission, editing/removing recurrence,
  one-time restrictions, and selecting a later calendar occurrence.
- Stripe route tests verify failed/paid invoices reconcile the current subscription.

Production-preparation verification used Node 22.23.2: 278 unit/integration
tests passed, the production build passed, lint had zero errors (seven existing
warnings), and the migrated disposable database had no Prisma schema drift.
The release-check tests cover pending/failed/unknown migrations and missing,
test-mode, disabled, wrong-site, and incomplete webhook destinations.

## Production prerequisites applied — September 11, 2026

- Full custom-format PostgreSQL backup saved outside Git at
  `.vercel/backups/production-before-recurring-events-20260911.dump` (138,831 bytes).
  Archive catalog verified for Business, Event and User table data; a full restore
  drill was not performed. SHA-256:
  `ac52a668d9992fd20a3a9dadaaa76bf5a139d560badb3a69e7bac2d048e33427`.
- Verified direct/pooled production target fingerprint matched the previous
  production repair. Only the recurrence migration was pending. Applied it with
  Prisma at `2026-09-11T20:00:12.937Z`; verified both columns and validated constraint.
- Added the two invoice events to live endpoint `we_1U6FQTCjD4JbKGc0tmTcTY8b`,
  preserving all previous event subscriptions, URL, status and signing secret.
- Set Vercel production `TX_LOCALIST_DATABASE_ENV=production` and project Node
  version `22.x`. A real staged build then exposed legacy `EVENT_POSTING_ENABLED=true`;
  set it to `false`, matching the existing hard-disabled one-time checkout path.
  This does not disable membership/Complimentary/staff recurring events.
- Vercel protects production secrets from CLI export. Production deployment now
  uses a remote build with `npm run build:vercel`; secrets are not downloaded,
  weakened, or copied into CI. The first staged build correctly refused the
  inconsistent event-posting flag without changing the live domain.
- Live `/api/health`, `/results`, `/events/results`, `/api/events` returned HTTP 200
  after migration; the live release remained `63529d0e77e5`.
- The second staged build passed the production release gate and Next.js build:
  `dpl_B5przmNKmXCUDQmZ3GHckZvydypy`,
  <https://txlocallist-86bqkuns6-infotxlocalist-6170s-projects.vercel.app>.
  All four smoke-test routes returned HTTP 200. Results pages were checked for
  error-boundary content and the events API for valid non-error JSON.
- The live domain still points to `dpl_VLcwPTrkNr8mXF8Bs65Nkh6xjSn3`; the staged
  build used `--prod --skip-domain` and was **not promoted**. No customer payment,
  subscription, or event was created/changed to test the feature. Signed invoice
  handling has automated test coverage, not a newly triggered live payment test.
- The release changes remain uncommitted/unpushed. Record the tested source in
  Git before the normal CI-gated release; the staged artifact is a verified
  working-tree build, not a new source commit. Final live promotion is pending.
