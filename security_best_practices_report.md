# TX Localist — Security and Web Quality Audit

Audit date: 2026-09-01  
Scope: Next.js application code, route handlers, server actions, Prisma schema/migrations, runtime configuration, dependency lockfile, automated tests, production build, and the public home page at a local production build (`http://127.0.0.1:3100/`).

## Executive summary

The codebase has a solid functional baseline: all 184 unit/integration tests pass, the production build succeeds, runtime configuration validation passes, session tokens are random and stored hashed, cookies use appropriate flags, privileged server actions generally perform server-side authorization, Stripe webhooks verify signatures, and event-image uploads have signature validation plus durable rate limiting.

It is not ready for an unqualified production launch. The highest-risk issue is a public endpoint that turns any known private Vercel Blob URL into a publicly cacheable response. This can defeat the privacy model for sensitive objects such as applicant resumes. Login/signup and the public resume flow also lack meaningful abuse controls. The locked dependency graph reports 14 production vulnerabilities (11 high), including the pinned Next.js release. Finally, the measured home-page mobile experience has a 7.23 s LCP, a 0.122 CLS, an avoidable 404, and confirmed WCAG contrast failures.

## Verification evidence

| Check | Result | Notes |
|---|---:|---|
| Unit/integration tests | Pass | 28 files, 184 tests |
| ESLint | Pass with warnings | 0 errors, 11 warnings (10 image warnings, 1 hook dependency warning) |
| Production build | Pass | 109 static/dynamic routes generated |
| Runtime configuration | Pass | Development configuration validated |
| Production dependency audit | Fail | 14 vulnerabilities: 11 high, 3 moderate (`npm audit --omit=dev`) |
| Lighthouse mobile Performance | 66 | Lab measurement; local production server |
| Lighthouse Accessibility | 96 | Automated checks only; not a WCAG conformance claim |
| Lighthouse Best Practices | 75 | Includes console/network and third-party-cookie failures |
| Lighthouse SEO | 100 | Homepage automated check only |
| End-to-end coverage | Weak | One health-endpoint test; no critical user journeys |

## Critical findings

### SEC-001 — Public proxy bypasses private-blob access control

- **Rule ID:** NEXT-FILES-002 / authorization boundary failure
- **Severity:** Critical
- **Location:** `src/app/api/blob-image/route.js:5-27`; `src/lib/blob.js:1-12`
- **Evidence:** The unauthenticated `GET /api/blob-image?url=...` handler accepts any string containing `.private.blob.vercel-storage.com`, retrieves it with the application's private Blob credentials, then returns it with `Cache-Control: public`. The same storage is used for applicant resumes (`src/app/api/applications/resume-upload/route.js:52-59`).
- **Impact:** Anyone who obtains or guesses a private Blob URL can use the application as an authorization-free decryption/proxy endpoint. Sensitive applicant resumes may be exposed and cached by shared infrastructure.
- **Fix:** Remove arbitrary URL proxying. Accept an application-owned media ID/path, load the corresponding database record, verify it is public business/event media, and only then read the blob. Keep resume download exclusively behind `src/app/api/dashboard/applications/[id]/resume/route.js`. Use `private, no-store` until a public-media authorization model is explicit.
- **Mitigation:** Immediately gate the legacy proxy behind a disabled-by-default production flag and reject `applications/resumes/` paths. Purge shared caches after deployment.
- **False-positive notes:** Vercel Blob URLs have high entropy, which reduces discoverability but does not create authorization. The endpoint explicitly turns possession of a URL into public access.

## High-priority findings

### SEC-002 — Known vulnerable production dependency graph

- **Rule ID:** NEXT-SUPPLY-001
- **Severity:** High
- **Location:** `package.json:22-41`; `package-lock.json`
- **Evidence:** `npm audit --omit=dev` reports 14 production vulnerabilities (11 high, 3 moderate), including `next@16.2.2` advisories for denial of service, middleware/proxy bypass, cache poisoning, XSS, and SSRF classes. Transitive findings include `postcss`, `sharp`, `undici`, `hono`, `fast-uri`, `mysql2`, and `deepmerge-ts`.
- **Impact:** Public request processing and image optimization may be exposed to published attacks. Exact exploitability varies by feature use, but the framework itself is in the affected range reported by npm.
- **Fix:** Upgrade Next.js to a patched supported release and update Prisma/transitives in a dedicated compatibility change; regenerate the lockfile, run the full test/build suite, and repeat `npm audit`. Do not blindly apply the suggested Prisma downgrade from `npm audit fix --force`.
- **Mitigation:** Apply edge request/body limits and rate limiting while upgrades are tested.
- **False-positive notes:** Several Prisma CLI-chain packages may not be exercised in production, but `next`, `sharp`, and framework transitives are production-relevant.

### SEC-003 — No brute-force or account-creation throttling

- **Rule ID:** NEXT-AUTH-006
- **Severity:** High
- **Location:** `src/app/actions/auth.js:51-132` and `205-267`
- **Evidence:** Signup and login perform database lookup and password hashing/verification on every request, with no per-account/IP throttling, progressive delay, CAPTCHA escalation, or lockout telemetry. Repository search finds rate limiting only for event-image uploads.
- **Impact:** Attackers can perform credential stuffing, password guessing, user enumeration through signup responses, and resource exhaustion through repeated scrypt work and account creation.
- **Fix:** Add a shared, durable rate limiter for auth actions (per normalized email plus trusted client-IP key), generic login errors, exponential cooldown, security logging, and a production `RATE_LIMIT_MODE=enforce` requirement.
- **Mitigation:** Configure platform/WAF limits on the server-action endpoints and alert on repeated failures.
- **False-positive notes:** An external edge policy may exist, but it is not visible in repository configuration and must be verified at runtime.

### SEC-004 — Public resume upload/application flow is abusable and does not bind uploads to submissions

- **Rule ID:** NEXT-FILES-001 / NEXT-RATE-001
- **Severity:** High
- **Location:** `src/app/api/applications/resume-upload/route.js:19-67`; `src/app/actions/businesses.js:805-863`
- **Evidence:** The upload route is unauthenticated and unlimited, validates only filename extension and an 8 MB client-reported size, and immediately stores a private blob. The application action accepts any syntactically valid HTTP(S) `resumeUrl`; it does not require that the URL corresponds to a newly reserved upload, the expected blob store/path, or an unused token owned by this application flow.
- **Impact:** Attackers can create storage/cost abuse and orphan blobs, upload files whose bytes do not match their extension, replay one upload across many applications, or attach arbitrary URLs to records reviewed by business owners.
- **Fix:** Use a database-backed upload reservation with a random ID, signature/MIME verification, per-IP/session quotas, expiry and cleanup, then atomically consume that reservation when creating the application. Store the canonical pathname/record ID rather than accepting a client-supplied URL.
- **Mitigation:** Enforce platform body/rate limits, add CAPTCHA after abuse signals, reject non-Blob URLs, and schedule orphan cleanup.
- **False-positive notes:** Private Blob storage prevents direct anonymous download but does not prevent upload cost abuse or record poisoning.

### PERF-001 — Homepage mobile LCP is 7.23 seconds

- **Severity:** High
- **Location:** `src/app/HomeExperience.jsx:247-256`; homepage data path `src/app/page.js:11-20`
- **Evidence:** Lighthouse mobile lab run measured FCP 3.03 s, LCP 7.23 s, and TTI 7.31 s. The full-viewport hero image is the LCP element; 43% of LCP was load delay and 41% transfer time. TTFB was ~994 ms.
- **Impact:** The primary landing experience feels slow on mobile and misses the 2.5 s good-LCP target by a wide margin.
- **Fix:** Produce a substantially smaller mobile hero asset/art direction, verify `fetchpriority=high` is emitted, avoid fetching/rendering data that blocks the initial shell, and profile the database-backed `getTopRatedLocals()` call. Re-measure on production-like infrastructure.
- **Mitigation:** Cache stable featured-business data and pre-render/revalidate the homepage where business requirements permit.
- **False-positive notes:** Local TTFB is environment-dependent, but the oversized LCP asset and measured load phases are concrete lab evidence.

### A11Y-001 — Confirmed WCAG AA color-contrast failures

- **Severity:** High
- **Location:** `src/components/BusinessCard/BusinessCard.module.css:43-57,86-89`; `src/components/Footer/Footer.module.css:86-92`
- **Evidence:** Lighthouse measured category text at 3.18:1, teal city badges at 3.18:1, a red badge at 4.32:1, and footer copyright at 2.94:1. Normal text requires 4.5:1.
- **Impact:** Low-vision users may be unable to read category, location, and copyright text.
- **Fix:** Darken the teal/red foreground-background combinations and remove opacity-based copyright coloring; test computed colors at 4.5:1 or better in all badge variants.
- **Mitigation:** Increase weight/size only if the resulting text meets the large-text definition and 3:1 threshold; color correction is preferable.
- **False-positive notes:** These are rendered, computed-color failures, not source-only guesses.

## Medium-priority findings

### SEC-005 — Missing application-level security headers

- **Rule ID:** NEXT-HEADERS-001 / REACT-CSP-001
- **Severity:** Medium
- **Location:** `next.config.mjs:7-28`; local homepage response headers
- **Evidence:** No global headers are configured. The measured response exposes `X-Powered-By: Next.js` and does not include CSP, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`.
- **Impact:** The app lacks defense in depth against XSS, clickjacking, MIME confusion, referrer leakage, and unnecessary browser capabilities.
- **Fix:** Add a tested global header policy. Start CSP in report-only mode, inventory Next.js/font/image/Stripe requirements, then enforce it without broad `unsafe-*` allowances. Disable `poweredByHeader`.
- **Mitigation:** Verify whether Vercel edge configuration injects equivalent headers in production.
- **False-positive notes:** Local response evidence does not prove production-edge absence; verify deployed headers before closing.

### COR-001 — Favorites endpoint accepts malformed/nonexistent targets and can return 500

- **Severity:** Medium
- **Location:** `src/app/api/favorites/route.js:20-49`
- **Evidence:** The endpoint checks only truthiness of `businessId`, then queries/creates directly. Unlike the likes endpoint (`src/app/api/likes/route.js:28-46`), it does not validate type/length or require an active, published business.
- **Impact:** Malformed JSON values and nonexistent IDs can trigger Prisma errors/500s; authenticated users may save listings that should not be publicly available if IDs are known.
- **Fix:** Mirror the likes endpoint's runtime schema checks and active/published owner filter, and return controlled 400/404 responses.
- **Mitigation:** Add route-level error handling and request limits.
- **False-positive notes:** Foreign keys prevent creation for nonexistent businesses, but currently convert bad input into server errors rather than safe client responses.

### PERF-002 — Unoptimized card/detail images waste bandwidth

- **Severity:** Medium
- **Location:** `src/components/BusinessCard/BusinessCard.jsx:40-47`; `src/app/business/[slug]/page.js:175-181`; additional ESLint warnings in gallery/results/favorites/event files
- **Evidence:** ESLint reports ten `<img>` optimization warnings. Lighthouse estimates 447 KiB savings on the homepage, including a 1274×709 image displayed at 358×169 and a 1200×667 image displayed at 304×203.
- **Impact:** Slower loading, more mobile data use, and degraded LCP/scroll performance.
- **Fix:** Route trusted remote images through `next/image` or an image CDN with explicit `sizes`, dimensions, modern formats, and quality limits. Avoid loading third-party originals directly.
- **Mitigation:** Pre-generate thumbnails during ingestion and store dimensions in `Photo`.
- **False-positive notes:** Provider cost/trust constraints may affect the loader choice, but responsive derivatives are still needed.

### PERF-003 — Material Icons webfont causes most layout shift

- **Severity:** Medium
- **Location:** icon font usage throughout components; global style/import path
- **Evidence:** Lighthouse measured CLS 0.122 (above the 0.1 good threshold); a Material Icons webfont load caused a 0.116 shift.
- **Impact:** Controls and hero content visibly move after initial render.
- **Fix:** Replace icon-font glyphs with fixed-size inline SVG/icon components, or self-host/preload the exact font and reserve stable geometry. Respect reduced-motion preferences for animated shifts.
- **Mitigation:** Apply fixed width/height/line-height to every icon container.
- **False-positive notes:** CLS may vary by cache state, but the font-triggered shift was captured directly.

### QA-001 — Critical journeys lack end-to-end coverage

- **Severity:** Medium
- **Location:** `tests/e2e/health.spec.js:1-14`; `playwright.config.mjs`
- **Evidence:** The sole Playwright test checks `/api/health`. There are no browser journeys for signup/login/logout, listing publication, search, favorites, uploads, application privacy, Stripe checkout/webhooks, cancellation, account deletion, admin moderation, or keyboard navigation.
- **Impact:** Passing unit tests and builds can still ship broken or insecure cross-layer workflows.
- **Fix:** Add a disposable test database and focused smoke journeys for auth, owner listing lifecycle, public search/detail, application authorization, and billing redirects/webhook idempotency. Add axe checks to representative pages.
- **Mitigation:** At minimum add unauthenticated/unauthorized route tests and a homepage console-error assertion.
- **False-positive notes:** Manual QA may exist, but it is not repeatable evidence in the repository.

### SEO-001 — Missing crawl-management artifacts and incorrect favicon reference

- **Severity:** Medium
- **Location:** `src/app/layout.js:33-41`; no `src/app/robots.*` or `src/app/sitemap.*`
- **Evidence:** The declared icon `/citryn-gold.png` does not exist and produces the homepage's console/network 404. No generated `robots.txt` or sitemap route exists. Default site metadata also describes an internal implementation (“secure signup, login, and a protected admin dashboard”) rather than the directory product.
- **Impact:** Browser errors and broken branding; weaker crawl discovery and poor fallback snippets on pages without overrides.
- **Fix:** Point icons to an existing asset or add the intended file; create `robots.js` and `sitemap.js`; set `metadataBase`, canonical/Open Graph defaults, and product-focused copy.
- **Mitigation:** Submit a generated sitemap through the deployment/search workflow.
- **False-positive notes:** Lighthouse SEO scored 100 for the homepage, but that category does not require a sitemap and the 404 is independently confirmed.

### DATA-001 — Redundant uniqueness/index declarations create schema ambiguity

- **Severity:** Medium
- **Location:** `prisma/schema.prisma:251,300` and `105-106,149`
- **Evidence:** `Business.slug` is globally `@unique` while the schema also declares `@@unique([slug, cityId])` with the comment “slug is unique per city, not global.” `User.email` is `@unique` and also has a redundant `@@index([email])`.
- **Impact:** The implemented constraint contradicts the documented per-city slug model and can block valid same-name businesses in different cities; redundant indexes add write/storage overhead.
- **Fix:** Decide the routing identity model. If slugs are per-city, route by city+slug and remove global uniqueness in a safe migration. Remove indexes already implied by unique constraints after checking the deployed database.
- **Mitigation:** Document that slugs are global until routing and migrations are changed.
- **False-positive notes:** Global slugs may be intentional for `/business/[slug]`; if so, remove the contradictory compound constraint/comment instead.

## Low-priority findings

### CODE-001 — Hook dependency warning can create stale/racy search behavior

- **Severity:** Low
- **Location:** `src/app/search/SearchResultsContent.jsx:37`
- **Evidence:** ESLint reports `useEffect` missing the `fetchResults` dependency.
- **Impact:** Refactors can leave the effect calling stale captured state, and repeated searches may race.
- **Fix:** Wrap the fetch function in `useCallback` with explicit dependencies or define it inside the effect; use `AbortController` to cancel stale requests.

### CODE-002 — Environment/toolchain mismatch is not enforced in the audit environment

- **Severity:** Low
- **Location:** `package.json:6-8`
- **Evidence:** The project requires Node `>=22 <23`, while this audit ran on Node 20.20.2 and npm emitted `EBADENGINE`. Tests and build passed, but unsupported runtime differences remain possible.
- **Impact:** Local/CI results may not exactly match production behavior.
- **Fix:** Pin Node 22 via `.nvmrc`, `.node-version`, Volta, or CI setup and make engine strictness explicit.

## What is working well

- Session tokens use 32 random bytes and only token hashes are persisted (`src/lib/auth/session.js:35-61`).
- Session cookies are `HttpOnly`, `SameSite=Lax`, path-scoped, and `Secure` in production (`src/lib/auth/session.js:17-24`).
- Passwords use salted Node scrypt and constant-time comparison (`src/lib/auth/password.js:8-30`).
- Redirect targets are constrained to same-origin relative paths and covered by tests (`src/lib/auth/redirect.js:1-30`).
- Admin and staff server actions generally call `requireAdmin()`/`requireStaff()` before mutation.
- Stripe webhook processing verifies the raw-body signature and has idempotency-oriented tests.
- Event-image uploads validate content signatures, reserve durable records, rate-limit, and clean up failures.
- Account deletion, billing reconciliation, payment policy, role transitions, and webhook behavior have meaningful unit/integration coverage.
- The homepage includes a skip link, a single main landmark, semantic controls, page language, and generally good automated accessibility results.

## Recommended order of work

1. Close SEC-001 and purge any shared cache entries for sensitive blobs.
2. Upgrade Next.js and production dependencies, then rerun tests/build/audit.
3. Add durable auth and resume-flow abuse controls; bind uploads to application records.
4. Add global security headers and verify them against the deployed site.
5. Fix contrast, favicon 404, hero delivery, icon-font CLS, and responsive card images.
6. Add Playwright coverage for the five critical cross-layer journeys.
7. Resolve schema constraint ambiguity and complete SEO crawl artifacts.

## Verification limits

- Lighthouse is a single mobile lab run against a local production build, not CrUX/field data.
- Automated accessibility testing cannot establish WCAG conformance; keyboard and screen-reader testing remain necessary.
- Authenticated/admin/billing browser states were not exercised because the repository has only a health E2E fixture and no isolated seeded E2E database was available.
- Production edge headers, WAF/rate limits, Vercel configuration, Stripe dashboard state, and historical secret exposure were not independently verified.
- `.env` values were intentionally not printed or included in this report. Git currently tracks only `.env.example`, not `.env`.
