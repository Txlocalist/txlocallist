---
type: "query"
date: "2026-09-01T23:53:45.294036+00:00"
question: "ehy is it working the loca env and not in the production env?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["UserRoleControl()", "AdminUsersPage()", "role-transitions.js", "admin.js"]
---

# Q: ehy is it working the loca env and not in the production env?

## Answer

Expanded from original query via vocab: [complimentary, role, enabled, production, config, admin, user, transition, access, local, environment]. Production and local checkout are on the same release f38210f, with no relevant local file differences. Current source hard-codes IMPLEMENTED_CAPABILITIES.billingMutationFence=false, so isComplimentaryRoleMutationsEnabled() returns false even when both environment flags are true. The admin UI consequently disables fresh USER-to-COMPLIMENTARY assignment and labels it assignment paused. The guard only identifies a grant where the old role is not COMPLIMENTARY and the new role is COMPLIMENTARY; existing Complimentary access and transitions away from Complimentary remain usable. If it appeared to work locally, that was an existing assignment/revocation or a previously running stale build; no local server was listening during inspection. This is intentional rollout gating, not a Stripe test-versus-live key difference.

## Outcome

- Signal: useful

## Source Nodes

- UserRoleControl()
- AdminUsersPage()
- role-transitions.js
- admin.js