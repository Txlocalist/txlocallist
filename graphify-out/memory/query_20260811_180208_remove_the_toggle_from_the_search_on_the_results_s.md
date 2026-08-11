---
type: "query"
date: "2026-08-11T18:02:08.794515+00:00"
question: "Remove the toggle from the search on the results search bar, and when loading /results without a filter or search load 15 recently added businesses."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SearchBar.jsx", "ResultsExperience.jsx", "page.js"]
---

# Q: Remove the toggle from the search on the results search bar, and when loading /results without a filter or search load 15 recently added businesses.

## Answer

Expanded from original query via graph vocab: [results, search, businesses, filter, query, page, listing, type]. The shared SearchBar.jsx owns the businesses/events selector; ResultsExperience.jsx configures the /results instance and triggers client search; api/search/route.js owns ordering and pagination. The selector is now hidden only for /results, and the empty initial state requests limit=15 ordered by publishedAt then createdAt descending while ordinary searches retain the default page size of 12.

## Outcome

- Signal: useful

## Source Nodes

- SearchBar.jsx
- ResultsExperience.jsx
- page.js