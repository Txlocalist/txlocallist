---
type: "query"
date: "2026-09-11T19:02:01.984010+00:00"
question: "can you fix the spacing on the home page on mobile where the tesxt is on red"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Home()", "LandingPageTemplate()", "HOME_QUICK_LINKS"]
---

# Q: can you fix the spacing on the home page on mobile where the tesxt is on red

## Answer

Expanded from original query via vocab: [home, landing, hero, quick, links]. The mobile business home hero is rendered by Home() through LandingPageTemplate() and HomeExperience. A mobile-only CSS rule now hides the optional hero artwork layer, which could crop as an empty color band, and uses compact 52px/48px vertical padding so the directory copy starts directly below the navigation. Desktop and event hero behavior remain unchanged.

## Outcome

- Signal: useful

## Source Nodes

- Home()
- LandingPageTemplate()
- HOME_QUICK_LINKS