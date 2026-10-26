# Coupons and special offers

Paid, complimentary, and staff creator access includes up to three saved offers per business. The setup wizard's third step and the business edit form share an editor with a live coupon preview. Owners can pause, renew, replace, or remove offers. Listing moderation and ownership rules continue to apply.

Offers contain a required headline, description, and redemption instructions, plus optional code, terms, and dates. Customers show the coupon or copy its code without signing in. No redemption records are created.

## Scheduling and persistence

`BusinessOffer.startDate` and `endDate` are ISO calendar-date strings in America/Chicago. Comparisons use today's Central calendar date, including both endpoints. An end date therefore covers its entire local day, including 23-hour and 25-hour daylight-saving days. Visibility is evaluated at read time; no cron task is needed. Open coupon pages and saved-result badges also refresh their calendar day on focus and every 30 seconds.

`normalizeBusinessOffers` validates both client and server input. The database constrains display order to slots 0, 1, and 2 with uniqueness per business. Nested writes are atomic with business updates. Omitted offers preserve stored data; an empty array removes it. Hard deletion of a business cascades to offers. Existing public-business access and moderation predicates hide offers when a listing becomes ineligible.

## Search interface

`/results?offers=1` and `/api/search?offers=1` restrict businesses to those with an active offer before count, sorting, and pagination. The legacy `/search` redirect preserves the parameter. Keyword, city, category, hiring, and saved filters can be combined with offers. Search results expose `offerWindows` containing only enabled/date metadata; upcoming coupon text is not exposed. Imported directory entries are hidden when the offer filter is active.

## Release and verification

1. Use Node 22. Apply `20261026000000_business_offers` through `prisma migrate deploy` against the explicitly verified target before releasing the new application. Do not use `db push`, since the SQL migration includes the three-slot check constraint.
2. Generate Prisma Client, run lint and unit tests, run `test:listings:db` against a disposable local PostgreSQL database using Unicode-aware collation, run the offer and listing browser tests, and build the application.
3. Verify the production project and database, back up the database, apply the migration, deploy, then check owner creation/editing and anonymous search/profile rendering. Remove any temporary smoke-test data afterward.

The additive table is safe to retain if application code is rolled back. Coupon fixtures and screenshots belong in ignored `test-results`; real customer profiles must not receive demonstration coupons.
