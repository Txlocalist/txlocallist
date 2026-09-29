# Category management

Admins manage two independent lists:

- `/admin/categories/business` adds and renames business categories in the existing `Category` table.
- `/admin/categories/event` adds and renames event categories in the new `EventCategory` table.

The same name can exist in both lists. Duplicate names (case-insensitive) and conflicting slugs are rejected within each list. Admin actions require the ADMIN role and write an audit entry in the same transaction. A stale rename form cannot overwrite another administrator's change.

Renames preserve category IDs and slugs. Existing business assignments and event assignments automatically display the current category name. Newly added categories appear in the appropriate creation/editing form, including categories without listings. Event discovery filters also include all managed event categories. Successful admin saves invalidate the layout cache; another open browser tab may need a refresh for new options.

Categories and free-form tags are distinct. Event forms submit an `EventCategory` ID and store it on `Event.categoryId`, rather than encoding the category in a tag. Business forms only accept IDs from the business `Category` table. The generic tag editor hides and rejects the reserved `Event Category:` prefix.

## Deployment

Apply `20260929000000_separate_event_categories` to the intended database before deploying the updated application. This migration:

1. Creates `EventCategory`, adds the event relation and index, and seeds the former fixed event choices.
2. Links existing events to their explicit legacy category or previously inferred display category. Older inferred labels outside the default list are preserved as additional event categories.
3. Retains legacy tags, event content, statuses, business assignments, and payments.

The relation is nullable to accommodate older writers during rollout. New event forms require a managed category. Legacy display fallback remains for events without a category relation. Old form submissions with a category name are resolved against the live event category list; current forms use stable IDs and continue working across renames.

`npm run db:seed-event-categories` ensures the initial event categories exist without overwriting admin renames. The older `db:seed-tags` command remains an alias for this seed script.

Verification: `npm test`, `npm run test:listings:db` against a disposable local database, and `tests/ui/categories.spec.js` with `playwright.listings.config.mjs`.
