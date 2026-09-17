---
type: "query"
date: "2026-09-17T20:03:51.019931+00:00"
question: "i ran this on local and got this error"
contributor: "graphify"
outcome: "useful"
source_nodes: ["getPublishedEvents()", "events.js", "migration"]
---

# Q: i ran this on local and got this error

## Answer

Expanded from the original report via graph vocabulary: events, published, prisma, database, migration. The connected Neon database has unapplied soft-deletion and weekly-recurrence migrations, while getPublishedEvents selected deletedAt, recurrence, and recurrenceUntil. The old fallback only removed likes, so its second query failed too. The fix adds staged public-event query profiles that preserve modern visibility rules when available and fall back to the older non-recurring schema without mutating the database.

## Outcome

- Signal: useful

## Source Nodes

- getPublishedEvents()
- events.js
- migration