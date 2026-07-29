# Graph Report - txlocallist  (2026-07-29)

## Corpus Check
- 144 files · ~606,885 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 624 nodes · 780 edges · 77 communities (60 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e979d9e6`
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
- EventsSection.jsx
- layout.js
- page.js
- EventLandingHeader.jsx
- blob.js
- eslint.config.mjs
- page.js
- Shared Components
- Q: Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages.
- Q: Inspect graphify-out for context before redesigning the how it works page.
- Q: Match the About page to the supplied visual reference
- Q: How is the how-it-works page composed, which shared components and routes does it depend on, and what must be preserved during a visual redesign?
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `scripts` - 19 edges
2. `DashboardLayout()` - 12 edges
3. `EventsResults()` - 10 edges
4. `parseFeatures()` - 10 edges
5. `upsertSubscriptionFromStripeSubscription()` - 9 edges
6. `normalizeEvent()` - 9 edges
7. `createBusinessAction()` - 6 edges
8. `EventCard()` - 6 edges
9. `dateObj()` - 6 edges
10. `dateWindowKeys()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/seed-event-data.mjs → package.json
- `AdminCreateForm()` --indirect_call--> `createAdminAction()`  [INFERRED]
  src/app/admin/AdminCreateForm.jsx → src/app/actions/auth.js
- `SignupForm()` --indirect_call--> `signUpAction()`  [INFERRED]
  src/app/signup/SignupForm.jsx → src/app/actions/auth.js
- `LoginForm()` --indirect_call--> `loginAction()`  [INFERRED]
  src/app/login/LoginForm.jsx → src/app/actions/auth.js
- `CreateEventForm()` --indirect_call--> `createEventAction()`  [INFERRED]
  src/app/dashboard/events/new/CreateEventForm.jsx → src/app/actions/events.js

## Import Cycles
- None detected.

## Communities (77 total, 17 thin omitted)

### Community 0 - "DashboardShell.jsx"
Cohesion: 0.07
Nodes (20): createEventAction(), getTextValue(), slugifyTag(), BillingPage(), getBillingStatusClass(), getNotice(), getSubscriptionDetail(), BusinessHoursEditor() (+12 more)

### Community 1 - "index.js"
Cohesion: 0.07
Nodes (6): BADGE_TONES, BUSINESS_CATEGORIES, EVENT_CATEGORIES, DEFAULT_LINKS, NavbarMobileMenu(), PhotoUploader()

### Community 2 - "scripts"
Cohesion: 0.07
Nodes (26): devDependencies, eslint, eslint-config-next, prisma, name, private, scripts, build (+18 more)

### Community 3 - "ResultsExperience.jsx"
Cohesion: 0.10
Nodes (11): ArrowRightIcon(), CameraIcon(), LoaderIcon(), MapPinIcon(), PlusCircleIcon(), ShareIcon(), metadata, ResultsPage() (+3 more)

### Community 4 - "EventsResults.jsx"
Cohesion: 0.14
Nodes (21): addDays(), CATEGORY_COLORS, DATE_FILTERS, dateObj(), dateWindowKeys(), DAYS, eventDate(), EventsResults() (+13 more)

### Community 5 - "createTagAction"
Cohesion: 0.12
Nodes (13): buildErrorState(), createTagAction(), getTextValue(), slugifyTag(), AdminCreateForm(), INITIAL_STATE, AdminShell(), AdminOverviewPage() (+5 more)

### Community 6 - "billing.js"
Cohesion: 0.16
Nodes (20): ACTIVE_SUBSCRIPTION_STATUSES, createStripeCheckoutSession(), createStripePortalSession(), ensureStripeCustomerForUser(), FEATURE_ACCESS_SUBSCRIPTION_STATUSES, getBillingDates(), getBillingPath(), getFreePlan() (+12 more)

### Community 7 - "dependencies"
Cohesion: 0.10
Nodes (17): dependencies, dotenv, @neondatabase/serverless, next, @prisma/adapter-neon, @prisma/client, react, react-dom (+9 more)

### Community 8 - "events.js"
Cohesion: 0.19
Nodes (20): addDays(), filterEvents(), formatCityLabel(), formatEventDateKey(), formatEventTime(), formatShortDateLabel(), getDateWindowKeys(), getEventById() (+12 more)

### Community 9 - "auth.js"
Cohesion: 0.15
Nodes (10): buildErrorState(), createAdminAction(), getTextValue(), loginAction(), signUpAction(), validateCredentials(), INITIAL_STATE, LoginForm() (+2 more)

### Community 10 - "EventsLanding.jsx"
Cohesion: 0.18
Nodes (14): dateFromKey(), DAY_NAMES, EventCard(), eventDay(), eventMonth(), EventsLanding(), eventWeekday(), FEATURED_CATEGORIES (+6 more)

### Community 11 - "businesses.js"
Cohesion: 0.24
Nodes (17): archiveBusinessAction(), buildErrorState(), createBusinessAction(), createBusinessFromFormAction(), generateSlug(), getTextValue(), isValidEmail(), isValidHttpUrl() (+9 more)

### Community 12 - "HomeExperience.jsx"
Cohesion: 0.14
Nodes (10): metadata, EVENT_CHIPS, EVENT_STEPS, FEATURED_BUSINESSES, FEATURED_EVENTS, FEATURES, HomeExperience(), STEPS (+2 more)

### Community 13 - "tiers.ts"
Cohesion: 0.18
Nodes (14): canBeFeatured(), canPostJobs(), canShowContact(), canShowSocials(), canShowWebsite(), getFeatures(), getMaxJobPostings(), getMaxPhotos() (+6 more)

### Community 14 - "page.js"
Cohesion: 0.25
Nodes (6): BusinessDetailPage(), getDomain(), parseHiringRoles(), SOCIAL_ICONS, PhotoGallery(), ShareButton()

### Community 15 - "session.js"
Cohesion: 0.33
Nodes (8): clearCurrentSession(), createUserSession(), getCurrentSession(), getCurrentUser(), getSessionCookieOptions(), hashToken(), requireAdmin(), requireUser()

### Community 16 - "index.js"
Cohesion: 0.42
Nodes (10): btn(), emailShell(), listingPublishedTemplate(), listingSuspendedTemplate(), sendEmail(), sendListingPublishedEmail(), sendListingSuspendedEmail(), sendWelcomeEmail() (+2 more)

### Community 17 - "admin.js"
Cohesion: 0.24
Nodes (3): mapModerationChoice(), revalidateAdminModerationPaths(), updatePostModerationStatusAction()

### Community 18 - "page.js"
Cohesion: 0.33
Nodes (8): AdminPostsPage(), BUSINESS_REVIEW_STATUSES, EVENT_REVIEW_STATUSES, formatDate(), getModerationBadgeClass(), getModerationValue(), getOwnerLabel(), ModerationForm()

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
Cohesion: 0.40
Nodes (3): adapter, DEFAULT_EVENT_TAGS, prisma

### Community 29 - "seed-italian-test.mjs"
Cohesion: 0.40
Nodes (3): adapter, PHOTOS, prisma

### Community 30 - "seed-plans.mjs"
Cohesion: 0.40
Nodes (3): adapter, PLANS, prisma

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
Cohesion: 0.40
Nodes (3): FAQ, metadata, PLANS

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

## Knowledge Gaps
- **136 isolated node(s):** `eslintConfig`, `@/*`, `__dirname`, `nextConfig`, `name` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `DashboardLayout()` connect `DashboardShell.jsx` to `page.js`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `@/*`, `__dirname` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DashboardShell.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0666049953746531 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07126436781609195 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `ResultsExperience.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09971509971509972 - nodes in this community are weakly interconnected._