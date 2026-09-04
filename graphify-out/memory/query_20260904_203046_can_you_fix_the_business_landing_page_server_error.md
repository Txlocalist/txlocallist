---
type: "query"
date: "2026-09-04T20:30:46.482238+00:00"
question: "Can you fix the business landing-page server error?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["BusinessDetailPage()", "getCurrentUser()", "session.js"]
---

# Q: Can you fix the business landing-page server error?

## Answer

Expanded from original query via graph vocab: [business, detail, page, revalidate, static, session, current, user, route]. Fixed the static-to-dynamic runtime failure by removing generateStaticParams, revalidate, and dynamicParams from src/app/business/[slug]/page.js and exporting dynamic = force-dynamic. Added a regression test that protects the cookie-backed rendering contract. Verification: targeted test passed, full suite passed 202 tests across 32 files, ESLint had zero errors, Next.js production build passed and classified /business/[slug] as dynamic, and a local production smoke request to a published slug returned HTTP 200 with private no-store caching.

## Outcome

- Signal: useful

## Source Nodes

- BusinessDetailPage()
- getCurrentUser()
- session.js