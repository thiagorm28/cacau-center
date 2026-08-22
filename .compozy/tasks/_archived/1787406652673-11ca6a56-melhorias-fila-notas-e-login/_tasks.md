---
schema_version: "compozy.tasks/v2"
workflow: melhorias-fila-notas-e-login
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
  edges:
    - from: task_01
      to: task_04
    - from: task_02
      to: task_04
---

# Melhorias na fila de notas e no login Task List

- **task_01** — Shared: extrair comparador de conclusão e adicionar `pickQuickScanNote`
- **task_02** — Backend: excluir nota em conferência
- **task_03** — Frontend: ver senha no login e na troca de senha
- **task_04** — Frontend: fila de notas — excluir, ver produtos e bipagem rápida (depende de task_01, task_02)
