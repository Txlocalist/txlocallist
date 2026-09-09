# Listing management, cities and sorting release

## Behavior

- Entitled owners can edit their businesses and membership events. Complimentary and staff access remain supported; legacy events do not acquire a new business-link requirement. Separately purchased events keep their existing date-range and payment rules.
- Owners can delete their own listings even after membership ends. The confirmation dialog starts on Keep, traps keyboard focus, supports Escape/cancel, disables actions during submission, displays errors, and permits retries.
- `Business.deletedAt` and `Event.deletedAt` hide deleted records in public queries, detail routes, saved results and owner lists. Business deletion also hides linked membership events, which remain manageable under My Events. Payment records and deletion audit entries remain stored. Deletion does not cancel billing or initiate refunds.
- Checkout must be verified or safely expired before event removal. A new or unresolved reservation blocks deletion. Concurrent edits, moderation, payment settlement, refunds and dispute restoration cannot clear deletion.
- Public membership listings require current creator entitlement. Past-due/unpaid/ended access hides approved content without changing its moderation status. Recovery only exposes otherwise approved, undeleted content. Cancellation at period end preserves access until that end, including when the final cancellation webhook is delayed.
- Admin → Cities accepts validated Texas city names and rejects duplicate names/slugs. Empty managed cities appear in both Explore city lists and business creation/edit dropdowns immediately after creation.
- Newest/Oldest use creation dates; saved lists use save dates and explicit labels. Alphabetical ordering ignores case. Business, event and user generated sort keys are maintained by PostgreSQL, including edits outside the app. Name/date ties use IDs. Upcoming and Most Saved remain available where relevant.
- Filters and sort selections persist through URL navigation and pagination; sorting happens before database pagination. Event calendar dates stay chronological while cards/lists use the selected ordering. Landing-page featured previews remain curated previews with links to full results.

## Migration-first release

Production deployment was not performed in this completion pass.

1. Use Node 22 and install the locked dependencies with `npm ci`.
2. Back up the target database and confirm the application's runtime environment with `npm run env:verify:production`.
3. Apply migrations to the correct production database with the existing `npm run db:migrate` workflow **before deploying this application revision**. The additive migration is `20260910000000_listing_soft_deletion`.
4. The migration adds nullable deletion timestamps, backfills existing archived businesses from `updatedAt`, and creates stored lowercase sort keys and indexes for Business, Event and User. Existing canceled events are intentionally not marked deleted. Generated columns/indexes require table locks while PostgreSQL builds them; allow a maintenance window appropriate to table size.
5. Generate the Prisma client (`npm run db:generate`) and deploy the verified application build. Avoid `prisma db push`: these generated expressions are deliberately supplied by the checked-in SQL migration.
6. Verify active/past-due account results, one-time events, city creation, deletion and sorting on the deployed revision. Existing Stripe `customer.subscription.created`, `.updated`, and `.deleted` webhook subscriptions must continue reaching the signed webhook endpoint.

Retain the new columns during rollback. Once users can delete content, rolling back to code without `deletedAt` guards is unsafe because refunds/moderation may change cancellation status. Prefer a forward fix, or retain the deletion and entitlement guards in any rollback revision.

## Verification and isolated fixtures

- `npm run lint`, `npm test`, and `npm run build` cover the normal release checks.
- The PostgreSQL suite uses real Prisma queries/transactions and no payment or email network calls. Start an empty local PostgreSQL database named `txlocalist_listing_test`, set `LISTING_TEST_DATABASE_URL` to its local connection string, and run `npm run test:listings:db`. The script applies all migrations first. To include these tests in the full suite, run `npm test` with the same variable set. Without it, these opt-in database tests are skipped. Never point this suite at a shared or production database.
- `npm run test:listings:ui` runs Chromium desktop/mobile checks against the real client components using a small Vite fixture app. Next routing, server actions and API responses are isolated mocks; the database suite separately verifies actual authorization, city persistence, filtering and pagination. UI fixtures never access the real application database or Stripe. This checks components and browser history, not a deployed end-to-end environment.
- UI coverage includes keyboard focus, Escape, Keep, disabled pending actions, errors and retries; all four basic sorts, Upcoming and Most Saved; saved filters; delayed response races; city dropdown propagation; and mobile overflow. Screenshots are written to ignored `test-results/listing-*.png` paths.
- Database coverage includes archived-record migration backfill, canceled event retention, generated sort keys, entitlement transitions, ownership, stale writes, concurrent deletion retries, one-time purchases, admin city validation/duplicates, and filtered pagination. Payment-service tests exercise refunds, disputes and late checkout callbacks after deletion.

The completion run used a disposable PostgreSQL 16 cluster on loopback port 55439. No application database migration or production deployment was performed.

Verified on September 9, 2026 with Node 22.23.2: 250 unit/integration tests (including 27 PostgreSQL tests), 16 desktop/mobile browser checks, and the production build passed. Lint passed with 11 existing image/hook warnings and no errors.
