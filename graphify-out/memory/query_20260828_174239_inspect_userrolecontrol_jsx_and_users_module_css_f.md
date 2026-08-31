---
type: "query"
date: "2026-08-28T17:42:39.832968+00:00"
question: "Inspect UserRoleControl.jsx and users.module.css for viewport centering and delete dialog accessibility."
contributor: "graphify"
outcome: "useful"
source_nodes: ["UserRoleControl()", "UserRoleControl.jsx", "AdminUsersPage()"]
---

# Q: Inspect UserRoleControl.jsx and users.module.css for viewport centering and delete dialog accessibility.

## Answer

Expanded from original query via graph vocab: [user, role, control, confirm, delete, admin, account]. The global reset sets every element margin to 0, overriding the native dialog auto margin. Make roleDialog position fixed with inset 0 and margin auto, retaining constrained width, max-height, and overflow. For delete confirmation, use a distinct native showModal dialog with unique aria-labelledby and aria-describedby, focus the safe Cancel action first, prevent Escape while pending, announce server errors, disable duplicate submission, and restore focus to the opener or a stable fallback after deletion.

## Outcome

- Signal: useful

## Source Nodes

- UserRoleControl()
- UserRoleControl.jsx
- AdminUsersPage()