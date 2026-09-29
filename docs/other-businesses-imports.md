# Other businesses spreadsheet imports

## Using the feature

Open **Admin → Import Businesses**. Download an Excel or CSV template, or export the current master list. The reusable CSV template is also available at `/templates/tx-localist-import-businesses-template.csv`. Fill the **Name, City, Category** columns with one category per business, save as CSV UTF-8, and keep this complete master file for every upload. The template contains headers only so no example businesses can accidentally go live. Excel imports read only the **Businesses** worksheet; the Instructions and Reference worksheets explain the format and supply current city/category dropdowns.

Upload the complete master list across all cities, then select **Preview changes**. Correct all reported rows before publishing. **Publish replacement list** replaces only imported entries, including removing entries omitted from the sheet. Full business listings and accounts are not modified. Empty lists cannot be published. Limits are 10,000 nonblank businesses and 3 MiB per file; XLSX processing also bounds expanded archive size and workbook complexity.

The source of truth is the last successfully published spreadsheet. Updating a local Excel file does not update the website until an admin uploads and publishes it. Publication is atomic, audited, and bound to the previewed file, directory revision, and current city/category names. Concurrent or outdated previews require another preview. Export the current sheet before making large changes if you need a copy to restore later.

CSV exports use a leading apostrophe for formula-like text, and double existing leading apostrophes. Imports reverse this convention so exported names round-trip safely. Use XLSX text cells to preserve names literally when preparing a new spreadsheet with leading apostrophes.

## Directory behavior

- The separate **Other businesses** section appears below full listings on `/results` and `/categories/[category]`. City, category and keyword filters apply. Imported entries use their own alphabetical 25-row pagination and count.
- Imported listings have no profile page, owner, subscription, contact information, photos or favorites. Selecting a row opens the invitation to join through the existing owner signup and billing flow.
- Matching full listings hide imports while they meet the existing public visibility rules, including complimentary/staff access. Matching uses PostgreSQL `lower(btrim(name))` and exact city ID. Internal spacing, punctuation and accents remain significant. Matching is applied before counting/pagination and is independent of the full listing's category.
- Imports remain in exports while hidden and can become visible again if the full listing is no longer public. Renaming a city/category preserves links. City deletion moves imports to Uncategorized and invalidates previews; a deletion that would create duplicate imported names there is blocked until the admin updates the master spreadsheet.

## Release

1. Use Node 22 and `npm ci` to install locked dependencies. The new libraries are server-side ExcelJS, csv-parse and csv-stringify.
2. Apply `20260929000000_imported_businesses` through the existing environment-verified `npm run db:migrate` workflow **before deploying the application**. It adds ImportedBusiness, BusinessImportState and lookup indexes. The expression index on Business requires an appropriate migration window for the table size. Do not substitute `db push` for the checked-in SQL.
3. Generate the Prisma client, run the checks below, and deploy. No new environment variables, storage buckets, scheduled tasks or cloud-sheet connection are required.
4. Smoke-test an ADMIN template download, a small preview/publish, filtered results, and the signup invitation. Check import audit records and server errors. Rollback application code without dropping the additive tables or imported data; recover an unwanted published sheet by publishing a previously saved export.

## Verification

- `npm test`: file parsing, generated workbook/CSV round trips, archive limits, API authorization and error handling, plus existing regressions.
- `npm run test:listings:db` with `LISTING_TEST_DATABASE_URL` pointing only to the disposable local `txlocalist_listing_test` database: runs existing listing tests and the import tests sequentially. Covers full replacement, audit rollback, concurrent publication, taxonomy changes, SQL/Prisma visibility parity, suppression before pagination, fallback-city conflicts, and 10,000-row imports. Use UTF-8 with an ICU locale such as en-US for Unicode case-folding coverage.
- `npm run test:listings:ui`: browser fixtures use the real components with isolated API mocks. Includes public list/modal and admin preview/publish behavior at desktop and mobile sizes. Database tests separately verify the real persistence/query layer.
- `npm run lint`, `npm run build`, and `npx prisma validate`.

The integration verification uses a disposable PostgreSQL cluster, independently of the production release.

Verified September 29, 2026 on Node 22.23.3 and PostgreSQL 16: 355 unit/API tests, 64 real-database tests, and 77 browser checks passed (11 desktop cases intentionally skip mobile-only scenarios). Prisma validation and the production build passed. Lint reported no errors and only existing warnings. The two city-deletion browser assertions were updated for the new imported-business count and passed on rerun.

Production migration applied September 29, 2026 at 23:02 UTC after a verified PostgreSQL custom-format backup in the gitignored `.vercel/backups/production-before-business-imports-20260929.dump`. Migration checksum, four indexes, three constraints, and singleton revision 0 were verified. Existing business/event/category/city record digests and business/event/user counts remained unchanged. The imported directory starts empty. The final template/admin-label changes passed 79 parser/API tests, 10 desktop/mobile admin browser checks, and targeted lint.

Release `7eb744a` reached Vercel production READY with the `txlocalist.com` alias. Live checks passed for the UTF-8 CSV template, public imported-directory API (25-row pagination), full listing search, results/category pages, admin login redirect, and all four import endpoints rejecting anonymous access. CI exposed a pre-existing `EventCategory.updatedAt` default mismatch; the Prisma annotation now matches the `CURRENT_TIMESTAMP` default in the earlier event-category migration without changing the database.
