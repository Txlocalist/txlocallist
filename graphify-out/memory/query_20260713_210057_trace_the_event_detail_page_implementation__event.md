---
type: "query"
date: "2026-07-13T21:00:57.816871+00:00"
question: "Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages."
contributor: "graphify"
outcome: "useful"
source_nodes: ["getEventById()", "SavedEventsPage()", "getPublishedEvents()"]
---

# Q: Trace the event detail page implementation, event image fields and fallback behavior, save/favorite counting system, and the equivalent real saved-count flow used on business landing pages.

## Answer

Expanded from original query via graph vocab: [event, events, detail, image, photo, saved, save, favorites, business, listing, user, users]. The graph identified getEventById() in src/lib/events.js as the event detail data source and SavedEventsPage() in src/app/dashboard/events/saved/page.js as the existing destination, while code verification found the reference count flow in src/app/business/[slug]/page.js and /api/favorites. Implemented the event design and parallel EventFavorite persistence flow using those verified sources.

## Outcome

- Signal: useful

## Source Nodes

- getEventById()
- SavedEventsPage()
- getPublishedEvents()