---
status: completed
title: Deploy — VPS/Docker/TLS
type: infra
complexity: medium
---

# Task 5: Deploy — VPS/Docker/TLS

## Overview

Prepara a topologia de deploy de produção decidida na ADR-011: um único VPS rodando
`backend`, `frontend` e Postgres atrás de um reverse proxy Caddy com TLS automático —
necessário porque um PWA instalável com acesso à câmera exige HTTPS. Sem esta tarefa, o
produto funciona apenas localmente.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `docker-compose.prod.yaml` with services for `backend`, `frontend` (production build served statically), `postgres`, and `caddy` (reverse proxy/TLS termination).
- MUST configure Caddy to obtain TLS automatically (Let's Encrypt) for the production domain and route API traffic to `backend` and everything else to the `frontend` build.
- MUST externalize all environment-specific configuration (domain, `EMPRESA_CODE`, JWT secret, Postgres credentials, `DATABASE_URL`) via environment variables, with a `.env.example` template — MUST NOT commit real secrets.
- MUST document, in a short README/comment (not a new planning document), the manual verification step from `_techspec.md`'s Technical Dependencies: confirming the chosen VPS can reach `http://hybrisreports.cacaushow.com.br` before go-live.
- MUST NOT introduce a Postgres schema namespace — plain default schema, consistent with Task 2's backend.
- SHOULD keep `docker-compose.prod.yaml` independent from the dev `docker-compose.yaml` (Task 2) — the dev compose is optimized for iteration, this one for the VPS topology.
</requirements>

## Subtasks
- [x] 5.1 Write `docker-compose.prod.yaml` (`backend`, `frontend`, `postgres`, `caddy` services).
- [x] 5.2 Write the `Caddyfile` (automatic TLS + routing rules: API to `backend`, rest to `frontend`).
- [x] 5.3 Define required environment variables and a `.env.example` template (no real secrets committed).
- [x] 5.4 Wire `backend`'s production start command and `frontend`'s production build output into their respective containers.
- [x] 5.5 Document the manual VPS-reachability check for the Cacau Show API endpoint (`http://hybrisreports.cacaushow.com.br`).
- [x] 5.6 Validate the compose stack (`docker compose -f docker-compose.prod.yaml config`, and a local `up` smoke test without a real TLS domain).

## Implementation Details

Reference `_techspec.md` → ADR-011, Known Risks (VPS connectivity to the Cacau Show
API), and the Impact Analysis row for `docker-compose.prod.yaml` + Caddy. This task
does not touch application code — it only wires the already-built `backend` and
`frontend` (from Tasks 2 and 3) into a production-ready container topology.

### Relevant Files
- `.compozy/tasks/conferencia-notas-fiscais/_techspec.md` — Integration Points, Known Risks, Impact Analysis rows for the prod compose/Caddy setup.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-011.md` — full rationale for the VPS + Docker Compose + Caddy topology and the connectivity risk to mitigate.
- `backend/docker-compose.yaml` (Task 2, dev) — reference for service definitions; not to be modified by this task.

### Dependent Files
- None outside the new production compose/Caddy/env files — no existing files are modified.

### Related ADRs
- [ADR-011: Deploy em VPS próprio via Docker Compose com reverse proxy TLS](adrs/adr-011.md) — the decision this entire task implements.

## Deliverables
- `docker-compose.prod.yaml`, `Caddyfile`, `.env.example`.
- Documented VPS-reachability verification step for the Cacau Show API.

## Tests

`_tests.md` does not assign any automated test case to this task — deployment topology
is outside the test contract's scope. Verify manually/inline instead:

- [x] `docker compose -f docker-compose.prod.yaml config` exits 0 with no errors.
- [x] A local `docker compose -f docker-compose.prod.yaml up` (without a real TLS domain/cert) successfully serves `backend` and `frontend` reachable through Caddy over plain HTTP, for smoke-testing the wiring.

## Success Criteria
- `docker compose -f docker-compose.prod.yaml config` validates cleanly
- The documented VPS-reachability check for `http://hybrisreports.cacaushow.com.br` is present and actionable
- No secrets are committed; all environment-specific values are externalized
