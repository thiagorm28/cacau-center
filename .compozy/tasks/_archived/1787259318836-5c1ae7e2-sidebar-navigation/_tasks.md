---
schema_version: "compozy.tasks/v2"
workflow: sidebar-navigation
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
  edges:
    - from: task_01
      to: task_02
    - from: task_02
      to: task_03
---

# Retractable Side Navigation Drawer Task List

1. **task_01 — Routing: shared route registry + App.tsx refactor** (`frontend`, `medium`) — no dependencies.
2. **task_02 — Layout: NavDrawer component + Screen wiring** (`frontend`, `high`) — depends on task_01.
3. **task_03 — Integration & E2E: full drawer navigation flow** (`test`, `medium`) — depends on task_02.
