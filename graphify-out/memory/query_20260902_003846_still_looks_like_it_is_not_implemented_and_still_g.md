---
type: "query"
date: "2026-09-02T00:38:46.395435+00:00"
question: "still looks like it is not implemented and still greyed out"
contributor: "graphify"
outcome: "useful"
source_nodes: ["UserRoleControl()", "AdminUsersPage()", "role-transitions.js", "billing.js"]
---

# Q: still looks like it is not implemented and still greyed out

## Answer

Expanded from original query via graph vocab: [complimentary, role, enabled, production, config, admin, user, transition, billing]. The production UI was correctly showing assignment paused because COMPLIMENTARY_ROLE_MUTATIONS_ENABLED had intentionally remained false after the fence-only deployment. The user screenshot proved authenticated Admin User Management loaded successfully, satisfying the final smoke gate. Enabled the Complimentary switch while keeping the billing fence enabled, redeployed commit 1339192 to production, confirmed the deployment Ready and canonical health OK. The existing browser tab must reload to receive the newly rendered enabled option.

## Outcome

- Signal: useful

## Source Nodes

- UserRoleControl()
- AdminUsersPage()
- role-transitions.js
- billing.js