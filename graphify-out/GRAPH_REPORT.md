# Graph Report - txlocallist  (2026-08-28)

## Corpus Check
- 217 files · ~636,576 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 983 nodes · 1362 edges · 131 communities (97 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1e5dc04e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DashboardShell.jsx
- index.js
- scripts
- ResultsExperience.jsx
- EventsResults.jsx
- createTagAction
- billing.js
- dependencies
- events.js
- auth.js
- EventsLanding.jsx
- businesses.js
- HomeExperience.jsx
- tiers.ts
- page.js
- session.js
- index.js
- admin.js
- page.js
- business-hours.js
- seed-admin.mjs
- layout.js
- seed-test-users.mjs
- page.js
- page.js
- page.js
- seed-categories.mjs
- seed-cities.mjs
- seed-event-tags.mjs
- seed-italian-test.mjs
- seed-plans.mjs
- billing.js
- route.js
- page.js
- page.js
- compilerOptions
- data.js
- password.js
- next.config.mjs
- page.js
- route.js
- route.js
- route.js
- page.js
- page.js
- page.js
- page.js
- layout.js
- page.js
- EventLandingHeader.jsx
- blob.js
- eslint.config.mjs
- route.js
- route.js
- prisma-errors.js
- page.js
- Shared Components
- Q: Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages.
- Q: Inspect graphify-out for context before redesigning the how it works page.
- Q: Match the About page to the supplied visual reference
- Q: How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?
- AGENTS.md
- directory-demo.js
- verify-event-posting-readiness.mjs
- event-dates.js
- role-transitions.js
- DashboardShell.jsx
- event-image-uploads.js
- events.js
- account-access.js
- page.js
- pricing.js
- One-Time Event Posting Launch
- setup-stripe-catalog.mjs
- seed-local-businesses.mjs
- page.js
- event-disputes.js
- route.js
- page.js
- Q: Remove the toggle from the search on the results search bar, and when loading /results without a filter or search load 15 recently added businesses.
- Q: Add a beautiful skeleton loader for the results page that looks like the cards.
- page.js
- page.js
- PricingCards.jsx
- account-access.test.js
- event-payment-policy.test.js
- event-payment-policy.js
- route.js
- event-checkout-validation.js
- stripe-webhooks.js
- event-payments.test.js
- stripe-webhooks.test.js
- event-dates.test.js
- event-image-upload-route.test.js
- event-payment-migration.test.js
- event-refund-status-migration.test.js
- event-review-refund-migration.test.js
- role-migration.test.js
- vercel.json
- EVENT_MAX_CALENDAR_DAYS

## God Nodes (most connected - your core abstractions)
1. `scripts` - 25 edges
2. `EventsResults()` - 16 edges
3. `DashboardLayout()` - 15 edges
4. `persistEventRefund()` - 12 edges
5. `verifyEventPostingReadiness()` - 11 edges
6. `upsertSubscriptionFromStripeSubscription()` - 11 edges
7. `withSerializableRetry()` - 10 edges
8. `createEventCheckoutSessionInternal()` - 10 edges
9. `parseFeatures()` - 10 edges
10. `fail()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `EventsResults()` --indirect_call--> `value()`  [INFERRED]
  src/app/events/results/EventsResults.jsx → scripts/verify-event-posting-readiness.mjs
- `getBillingPath()` --indirect_call--> `value()`  [INFERRED]
  src/lib/billing.js → scripts/verify-event-posting-readiness.mjs
- `getStripeSubscriptionPeriodEnd()` --indirect_call--> `value()`  [INFERRED]
  src/lib/subscription-period.js → scripts/verify-event-posting-readiness.mjs
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/seed-event-data.mjs → package.json
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/seed-local-businesses.mjs → package.json

## Import Cycles
- None detected.

## Communities (131 total, 34 thin omitted)

### Community 0 - "DashboardShell.jsx"
Cohesion: 0.27
Nodes (4): BusinessHoursEditor(), EditBusinessForm(), parseHiringRoles(), CreateBusinessForm()

### Community 1 - "index.js"
Cohesion: 0.06
Nodes (12): BADGE_TONES, BUSINESS_CATEGORIES, EVENT_CATEGORIES, LikeCount(), normalizeCount(), numberFormatter, DEFAULT_LINKS, NavbarMobileMenu() (+4 more)

### Community 2 - "scripts"
Cohesion: 0.05
Nodes (34): devDependencies, eslint, eslint-config-next, @playwright/test, prisma, vitest, name, private (+26 more)

### Community 3 - "ResultsExperience.jsx"
Cohesion: 0.08
Nodes (16): ArrowRightIcon(), CameraIcon(), PlusCircleIcon(), ShareIcon(), getFavoriteBusinessInclude(), metadata, ResultsPage(), toBusinessResult() (+8 more)

### Community 4 - "EventsResults.jsx"
Cohesion: 0.14
Nodes (26): addDays(), CATEGORY_COLORS, DATE_FILTERS, dateObj(), dateWindowKeys(), DAYS, eventDate(), eventDateKeys() (+18 more)

### Community 5 - "createTagAction"
Cohesion: 0.13
Nodes (11): buildErrorState(), createTagAction(), getTextValue(), slugifyTag(), AdminShell(), AdminOverviewPage(), formatDate(), INITIAL_STATE (+3 more)

### Community 6 - "billing.js"
Cohesion: 0.14
Nodes (24): ACTIVE_SUBSCRIPTION_STATUSES, createStripeCheckoutSession(), createStripePortalSession(), enforceComplimentaryCancellation(), ensureStripeCustomerForUser(), FEATURE_ACCESS_SUBSCRIPTION_STATUSES, findPlanForStripeSubscription(), getBillingPath() (+16 more)

### Community 7 - "dependencies"
Cohesion: 0.12
Nodes (14): dependencies, date-fns-tz, dotenv, @neondatabase/serverless, next, @prisma/adapter-neon, react, react-dom (+6 more)

### Community 8 - "events.js"
Cohesion: 0.22
Nodes (18): addDays(), filterEvents(), formatCityLabel(), formatShortDateLabel(), getDateWindowKeys(), getEventById(), getEventCategories(), getEventCities() (+10 more)

### Community 9 - "auth.js"
Cohesion: 0.15
Nodes (10): buildErrorState(), createStaffAction(), getTextValue(), loginAction(), signUpAction(), validateCredentials(), INITIAL_STATE, LoginForm() (+2 more)

### Community 10 - "EventsLanding.jsx"
Cohesion: 0.18
Nodes (14): dateFromKey(), DAY_NAMES, EventCard(), eventDay(), eventMonth(), EventsLanding(), eventWeekday(), FEATURED_CATEGORIES (+6 more)

### Community 11 - "businesses.js"
Cohesion: 0.24
Nodes (17): archiveBusinessAction(), buildErrorState(), createBusinessAction(), createBusinessFromFormAction(), generateSlug(), getTextValue(), isValidEmail(), isValidHttpUrl() (+9 more)

### Community 12 - "HomeExperience.jsx"
Cohesion: 0.14
Nodes (10): metadata, EVENT_CHIPS, EVENT_STEPS, FEATURED_EVENTS, FEATURES, HOME_QUICK_LINKS, HomeExperience(), STEPS (+2 more)

### Community 13 - "tiers.ts"
Cohesion: 0.18
Nodes (14): canBeFeatured(), canPostJobs(), canShowContact(), canShowSocials(), canShowWebsite(), getFeatures(), getMaxJobPostings(), getMaxPhotos() (+6 more)

### Community 14 - "page.js"
Cohesion: 0.25
Nodes (6): BusinessDetailPage(), getDomain(), parseHiringRoles(), SOCIAL_ICONS, PhotoGallery(), ShareButton()

### Community 15 - "session.js"
Cohesion: 0.30
Nodes (9): clearCurrentSession(), createUserSession(), getCurrentSession(), getCurrentUser(), getSessionCookieOptions(), hashToken(), requireAdmin(), requireStaff() (+1 more)

### Community 16 - "index.js"
Cohesion: 0.42
Nodes (10): btn(), emailShell(), listingPublishedTemplate(), listingSuspendedTemplate(), sendEmail(), sendListingPublishedEmail(), sendListingSuspendedEmail(), sendWelcomeEmail() (+2 more)

### Community 17 - "admin.js"
Cohesion: 0.16
Nodes (3): mapModerationChoice(), revalidateAdminModerationPaths(), updatePostModerationStatusAction()

### Community 18 - "page.js"
Cohesion: 0.27
Nodes (9): AdminPostsPage(), BUSINESS_HISTORY_STATUSES, EVENT_HISTORY_STATUSES, formatDate(), formatMoney(), getModerationBadgeClass(), getModerationValue(), getOwnerLabel() (+1 more)

### Community 19 - "business-hours.js"
Cohesion: 0.50
Nodes (7): BUSINESS_DAYS, createBusinessHoursFormState(), formatBusinessHoursValue(), formatBusinessTime(), getBusinessHoursDisplayRows(), normalizeBusinessHoursInput(), sanitizeTimeValue()

### Community 20 - "seed-admin.mjs"
Cohesion: 0.33
Nodes (5): adapter, email, hashPassword(), prisma, scrypt

### Community 21 - "layout.js"
Cohesion: 0.25
Nodes (6): bungee, geistMono, metadata, shrikhand, spaceGrotesk, ultra

### Community 22 - "seed-test-users.mjs"
Cohesion: 0.40
Nodes (5): adapter, hashPassword(), prisma, scrypt, TEST_ACCOUNTS

### Community 23 - "page.js"
Cohesion: 0.47
Nodes (3): ApplyForm(), BusinessApplyPage(), parseHiringRoles()

### Community 25 - "page.js"
Cohesion: 0.47
Nodes (3): metadata, buildMailtoUrl(), SuggestBusinessForm()

### Community 26 - "seed-categories.mjs"
Cohesion: 0.40
Nodes (3): adapter, CATEGORIES, prisma

### Community 27 - "seed-cities.mjs"
Cohesion: 0.40
Nodes (3): adapter, prisma, TEXAS_CITIES

### Community 28 - "seed-event-tags.mjs"
Cohesion: 0.25
Nodes (7): adapter, prisma, EVENT_CATEGORIES, EVENT_CATEGORY_SET, fromEventCategoryTagName(), isEventCategory(), isEventCategoryTagName()

### Community 29 - "seed-italian-test.mjs"
Cohesion: 0.40
Nodes (3): adapter, PHOTOS, prisma

### Community 30 - "seed-plans.mjs"
Cohesion: 0.33
Nodes (4): adapter, PLANS, prisma, requireStripePrices

### Community 31 - "billing.js"
Cohesion: 0.90
Nodes (4): createBillingPortalSessionAction(), createCheckoutSessionAction(), redirectToBilling(), requireBillingUserContext()

### Community 32 - "route.js"
Cohesion: 0.70
Nodes (4): ALLOWED_EXTENSIONS, hasAllowedExtension(), POST(), sanitizeFileName()

### Community 33 - "page.js"
Cohesion: 0.40
Nodes (3): BENEFITS, metadata, STEPS

### Community 34 - "page.js"
Cohesion: 0.12
Nodes (40): ACTIVE_CHECKOUT_STATUSES, approveEventForPublication(), cancelEventPosting(), checkoutCreationPromises, compactError(), createEventCheckoutSession(), createEventCheckoutSessionInternal(), denyEventForRevision() (+32 more)

### Community 35 - "compilerOptions"
Cohesion: 0.50
Nodes (3): compilerOptions, paths, @/*

### Community 39 - "password.js"
Cohesion: 0.83
Nodes (3): hashPassword(), scrypt, verifyPassword()

### Community 47 - "page.js"
Cohesion: 0.29
Nodes (3): LOCAL_STEPS, metadata, OWNER_STEPS

### Community 69 - "page.js"
Cohesion: 0.28
Nodes (3): OverviewContent(), DashboardPage(), titleCase()

### Community 70 - "Shared Components"
Cohesion: 0.33
Nodes (5): Accessibility defaults, Conventions, Current inventory, Design tokens, Shared Components

### Community 71 - "Q: Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages., Source Nodes

### Community 72 - "Q: Inspect graphify-out for context before redesigning the how it works page."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Inspect graphify-out for context before redesigning the how it works page., Source Nodes

### Community 73 - "Q: Match the About page to the supplied visual reference"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Match the About page to the supplied visual reference, Source Nodes

### Community 74 - "Q: How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?, Source Nodes

### Community 79 - "verify-event-posting-readiness.mjs"
Cohesion: 0.11
Nodes (35): @prisma/client, adapter, main(), prisma, ACTIVE_PAYMENT_STATUSES, fail(), formatReadinessReport(), isLocalHostname() (+27 more)

### Community 80 - "event-dates.js"
Cohesion: 0.17
Nodes (26): ALLOWED_EVENT_TIME_ZONES, ALLOWED_TIME_ZONE_SET, asValidDate(), dateKeyToUtcDate(), eventOccursOnDateKey(), formatEventDateKey(), formatEventDateRange(), formatEventTime() (+18 more)

### Community 81 - "role-transitions.js"
Cohesion: 0.15
Nodes (24): ACCESS_FILTERS, AdminUsersPage(), formatDate(), pageHref(), toneClass(), formatDate(), formatMoney(), ROLE_LABELS (+16 more)

### Community 82 - "DashboardShell.jsx"
Cohesion: 0.16
Nodes (4): DashboardLayout(), EVENT_POST_PRICE, metadata, metadata

### Community 83 - "event-image-uploads.js"
Cohesion: 0.26
Nodes (9): claimError(), claimEventImageUpload(), cleanupEventImageUploadsByIds(), cleanupStaleEventImageUploads(), compactError(), deleteTrackedUpload(), deleteUploadBatch(), normalizeBatchLimit() (+1 more)

### Community 84 - "events.js"
Cohesion: 0.39
Nodes (11): createEventAction(), deleteEventAction(), getTextValue(), getValidatedEventInput(), isSafeEventUrl(), resubmitEventAction(), retryEventCheckoutAction(), revalidateEventPaths() (+3 more)

### Community 85 - "account-access.js"
Cohesion: 0.30
Nodes (10): billingDates(), deriveUserStatusTags(), getAccountAccess(), hasStripeFeatureAccess(), isStaffRole(), PAID_ACCESS_STATUSES, PLAN_SELECT, resolveAccountAccess() (+2 more)

### Community 86 - "page.js"
Cohesion: 0.24
Nodes (5): metadata, CreateEventForm(), errorAttributes(), INITIAL_STATE, metadata

### Community 87 - "pricing.js"
Cohesion: 0.25
Nodes (8): EVENT_POST_CHECKOUT_DISCLOSURE, EVENT_POST_PRICE_LABEL, getEventPostPriceId(), PRICING_OFFERS, retrieveAndValidateStripePrice(), secretUsesLiveMode(), validateEventPostPrice(), validateStripePriceObject()

### Community 88 - "One-Time Event Posting Launch"
Cohesion: 0.22
Nodes (8): Acceptance test, Automated read-only preflight, Catalog decision, One-Time Event Posting Launch, Policy and operations, Production rollout and database deployment, Required production settings, Stripe webhook

### Community 89 - "setup-stripe-catalog.mjs"
Cohesion: 0.39
Nodes (7): ensureEventPrice(), ensureEventProduct(), ensureMembershipPrice(), findPrice(), getConfiguredMembershipPrice(), secretKey, stripe

### Community 90 - "seed-local-businesses.mjs"
Cohesion: 0.38
Nodes (6): AUSTIN, createPasswordHash(), LOCAL_BUSINESSES, main(), prisma, scrypt

### Community 91 - "page.js"
Cohesion: 0.38
Nodes (3): FavoritesDashboard(), formatSavedDate(), SORT_OPTIONS

### Community 92 - "event-disputes.js"
Cohesion: 0.29
Nodes (4): FAVORABLE_EVENT_DISPUTE_STATUSES, favorableStatuses, TERMINAL_EVENT_DISPUTE_STATUSES, terminalStatuses

### Community 93 - "route.js"
Cohesion: 0.60
Nodes (5): ALLOWED_CONTENT_TYPES, compactError(), discardReservedUpload(), POST(), sanitizeFileName()

### Community 94 - "page.js"
Cohesion: 0.47
Nodes (4): CancelEventButton(), DashboardEventsPage(), EVENT_POST_PRICE, getEventStatusClass()

### Community 95 - "Q: Remove the toggle from the search on the results search bar, and when loading /results without a filter or search load 15 recently added businesses."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Remove the toggle from the search on the results search bar, and when loading /results without a filter or search load 15 recently added businesses., Source Nodes

### Community 96 - "Q: Add a beautiful skeleton loader for the results page that looks like the cards."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Add a beautiful skeleton loader for the results page that looks like the cards., Source Nodes

### Community 97 - "page.js"
Cohesion: 0.70
Nodes (4): BillingPage(), getBillingStatusClass(), getNotice(), getSubscriptionDetail()

### Community 98 - "page.js"
Cohesion: 0.40
Nodes (3): eventPostPrice, membershipPrice, metadata

### Community 99 - "PricingCards.jsx"
Cohesion: 0.40
Nodes (3): eventPostPrice, membershipPrice, plans

### Community 101 - "event-payment-policy.test.js"
Cohesion: 0.40
Nodes (4): endDate, event, payment, startDate

### Community 102 - "event-payment-policy.js"
Cohesion: 0.83
Nodes (3): NON_REFUNDING_CANCELLATION_REASONS, sameInstant(), shouldKeepSettledPaymentForCancelledEvent()

## Knowledge Gaps
- **206 isolated node(s):** `eslintConfig`, `@/*`, `__dirname`, `nextConfig`, `name` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `ResultsPage()` (2× useful, score=1.07252975)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `value()` connect `verify-event-posting-readiness.mjs` to `EventsResults.jsx`, `billing.js`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `verify-event-posting-readiness.mjs` to `seed-local-businesses.mjs`, `dependencies`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`, `verify-event-posting-readiness.mjs`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `@/*`, `__dirname` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06006006006006006 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `ResultsExperience.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0784313725490196 - nodes in this community are weakly interconnected._