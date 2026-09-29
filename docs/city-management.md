# City management

Admins can add, rename, and delete cities at `/admin/cities`.

- Renaming updates the shared City record, so all businesses display its current name. The city ID and slug stay unchanged to preserve existing associations and city links. Matching event locations in Texas (US) also receive the new name.
- Deleting requires confirmation. All businesses, including archived listings, and matching Texas events move to the protected **Uncategorized** fallback. No business or event is deleted; subscriptions, payments, publication status, and street addresses are preserved. The audit log records the original city, fallback ID, and affected counts.
- Uncategorized is created on the first deletion and cannot be created, renamed, or deleted through the admin city controls. It is excluded from new listing selectors. Existing affected listings can retain it while being edited, or select a replacement city.
- Business and event creation/editing load the database city list, including cities without listings. Successful city changes invalidate the site's layout cache. Forms already open in another browser tab may need a refresh to see newly added options.
- Event forms submit the city ID, and the server resolves its current name when saving. Old event locations that are not in the managed list can be retained during editing. A deleted city selected in a stale form produces a validation error instead of restoring the deleted name.

City changes and audit writes are atomic. Admin taxonomy changes are serialized, and city row locks coordinate event saves with renames/deletions. No database migration is required.

Verification uses `npm test`, `npm run test:listings:db` with a disposable local database, and the city/event form cases in `npm run test:listings:ui`.
