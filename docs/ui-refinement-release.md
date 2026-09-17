# UI refinement release verification — September 17, 2026

## Status

Code and database checks pass. Ready for a preview/staging deployment; production
promotion still requires verification of that hosted revision and a current backup.
No application deployment or production database mutation was performed in this pass.

## Navigation fix

Event-results sorting, query, city, date, category and saved-only filters now read
directly from the URL. Native history changes, Back, Forward and reload restore the
controls and displayed results together. Search-field drafts remain local until
submitted. Regression tests cover sorting, combined filters and saved-event history
on mobile and desktop.

## Verification

- Node 22.23.2 production build passed.
- Lint passed with no errors and six existing image/hook warnings.
- All 284 tests passed, including 36 PostgreSQL integration tests; none skipped.
- All 18 migrations applied to a fresh disposable PostgreSQL 16 database bound to
  localhost. No shared database was used by the integration tests.
- Browser suite: 42 passed; six mobile-only cases intentionally skipped in the
  desktop project. Final run used two workers with no source edits during execution.
- The built Next.js application returned HTTP 200 for `/`, `/events`, `/results`
  and `/events/results` at phone and desktop widths. Event sorting and Back/Forward
  were checked against the actual production build, with no page JavaScript errors.
  These local checks used the development database, which still logs missing-column
  errors handled by compatibility fallbacks; they are not a clean database smoke test.
- The read-only release gate passed using Node 22 and the explicit production
  configuration identified by prior release records. All checked-in migrations
  are already applied; recurrence columns and the validated constraint exist.
  Live Stripe endpoint configuration checks also passed. This does not prove a
  fresh signed webhook delivery or validate remote hosting environment settings.
- A separate read-only comparison of every Prisma scalar field to production's
  `information_schema.columns` found no missing columns. The development database
  is behind on deletion/sorting, billing-fence and recurrence schema changes. It
  was not migrated; this drift is separate from the verified production target.
- The September 11 production backup archive catalog is readable and includes
  Business, Event and User data. It is not a fresh backup for this release.

## Deployment handoff

Production deployment was subsequently authorized on September 17. Before pushing
the release, a fresh custom-format backup was created at the git-ignored
`.vercel/backups/production-before-ui-refinement-20260917.dump` (146,507 bytes;
SHA-256 `b8172dfca2d6306675ee20d08e6851a7d3a42f6248c340f73fe55bbc719d7761`).
Its archive catalog was verified. `prisma migrate deploy` ran against the verified
production target under Node 22 and reported no pending migrations. The existing
GitHub CI → production deployment workflow will release the pushed main revision;
its hosted checks and final deployment status are reported in the release task.

1. Commit the complete reviewed UI change set, including its new components and
   tests. Keep `.env*`, `.vercel`, backup files and unrelated graph output out.
2. Use Node 22 in the hosting environment and deploy a preview of that exact revision.
3. Verify public search/filter/history flows and authenticated user/admin navigation,
   saving and account switching on the hosted preview, using appropriately isolated
   test accounts/data. Keep existing event-posting rollout flags unchanged.
4. Confirm a current production backup/recovery point before promotion. No new
   database migration is required for these UI changes; do not use `prisma db push`.
5. Run the existing production release gate with the intended production environment,
   then promote only after preview checks pass. Check deployed routes and logs afterward.

Local `.env.local` and the production configuration target different databases.
Never infer the production migration target from an ordinary local Prisma command.
