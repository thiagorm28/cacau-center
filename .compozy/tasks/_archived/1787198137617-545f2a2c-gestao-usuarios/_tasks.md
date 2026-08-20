---
schema_version: "compozy.tasks/v2"
workflow: gestao-usuarios
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
      to: task_02
    - from: task_01
      to: task_03
    - from: task_02
      to: task_03
    - from: task_03
      to: task_04
---

# Gestão de Usuários e Papel Admin Task List

1. **task_01** — Fundação de autenticação e schema (backend, `critical`)
2. **task_02** — Usecases e API de gestão de usuários (backend, `high`) — depende de task_01
3. **task_03** — Sessão, roteamento e troca de senha obrigatória (frontend, `medium`) — depende de task_01, task_02
4. **task_04** — Tela de gestão de usuários (frontend, `medium`) — depende de task_03
