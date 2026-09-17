---
type: "query"
date: "2026-09-17T20:27:12.572707+00:00"
question: "its still showing the dashboard on mobile nnot the main nav menu"
contributor: "graphify"
outcome: "corrected"
correction: "Use the shared primary NavbarMobileMenu for the mobile events results hamburger; never open the desktop event-filter sidebar from that button."
source_nodes: ["EventsResults.jsx", "NavbarMobileMenu.jsx", "Navbar"]
---

# Q: its still showing the dashboard on mobile nnot the main nav menu

## Answer

Expanded from original query via graph vocabulary: [dashboard, event, events, header, home, landing, link, links, menu, mobile, navbar, results]. The prior mobile drawer fix was incorrect because it continued to expose the desktop event-browsing sidebar. EventsResults now renders the shared NavbarMobileMenu in the mobile header with Home, Explore Businesses, Events, About, Add Listing, and Login or Dashboard. The event sidebar is desktop-only, and city selection moved into the mobile Filters drawer.

## Outcome

- Signal: corrected
- Correction: Use the shared primary NavbarMobileMenu for the mobile events results hamburger; never open the desktop event-filter sidebar from that button.

## Source Nodes

- EventsResults.jsx
- NavbarMobileMenu.jsx
- Navbar