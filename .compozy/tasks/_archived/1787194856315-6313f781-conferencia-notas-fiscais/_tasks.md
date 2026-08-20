---
schema_version: "compozy.tasks/v2"
workflow: conferencia-notas-fiscais
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
  edges:
    - from: task_01
      to: task_02
    - from: task_01
      to: task_03
    - from: task_02
      to: task_03
    - from: task_02
      to: task_04
    - from: task_03
      to: task_04
    - from: task_02
      to: task_05
    - from: task_03
      to: task_05
---

# Conferência de Notas Fiscais Task List

1. **Task 1 — Motor de alocação compartilhado** (`shared`, scaffold do monorepo). Sem dependências.
2. **Task 2 — Backend (serviço de conferência)**. Depende da Task 1.
3. **Task 3 — Frontend (PWA)**. Depende das Tasks 1 e 2.
4. **Task 4 — Suíte E2E**. Depende das Tasks 2 e 3.
5. **Task 5 — Deploy (VPS/Docker/TLS)**. Depende das Tasks 2 e 3.
