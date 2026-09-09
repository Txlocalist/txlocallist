---
type: "query"
date: "2026-09-09T17:53:45.761199+00:00"
question: "when a new event is made the categories say event crategorie? why is it displaying event when these are business categories. can we fix that? seems like there is a bug when a business is created and category is selected and it gets added to the explore page."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ResultsExperience.jsx", "page.js", "businesses.js", "CreateBusinessForm.jsx"]
---

# Q: when a new event is made the categories say event crategorie? why is it displaying event when these are business categories. can we fix that? seems like there is a bug when a business is created and category is selected and it gets added to the explore page.

## Answer

Expanded from original query via graph vocab: [business, businesses, category, categories, create, event, events, filter, results, tags]. The graph traced Explore to ResultsExperience.jsx and src/app/results/page.js, which populated the Categories menu from prisma.tag even though event categories are stored as prefixed Tag records. Fixed Explore to query active BusinessCategory/Category relations, pass availableCategories, and filter via the category slug. Also wired Category selection through CreateBusinessForm and EditBusinessForm, filtered event-category tags from business tag pickers, and rejected reserved event-category tags in businesses.js.

## Outcome

- Signal: useful

## Source Nodes

- ResultsExperience.jsx
- page.js
- businesses.js
- CreateBusinessForm.jsx