---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: docker-compose.prod.yaml
line: 79
severity: medium
author: claude-code
provider_ref:
---

# Issue 011: No healthchecks — Caddy can route to backend before it's ready

## Review Comment

Only the `postgres` service has a `healthcheck`, and only `backend` depends on it with
`condition: service_healthy`. `caddy`'s `depends_on: [backend, frontend]` has no
condition, so Compose only waits for those containers to *start*, not for the NestJS
app to finish running Drizzle migrations and start listening (`bootstrap.ts` runs
migrations before calling `listen`). On a fresh deploy or restart, this produces a
window where Caddy is up and routing but the backend isn't ready yet — 502s or
connection-refused responses for the operator, with no health signal available to gate
a rolling restart or alert on.

Suggested fix: add a `healthcheck` to `backend` (e.g. `wget`/`curl` against `/auth/me`,
treating a `401` response as healthy since it proves the process is listening and
routing) and to `frontend` (curl `:80`), then change `caddy`'s `depends_on` entries to
`condition: service_healthy` for both.

## Triage

- Decision: `VALID`
- Notes:
  - Confirmado na origem. `backend/src/main.ts:10-13` cria o app, roda
    `runMigrations(app)` e só então chama `app.listen(port)`. Ou seja, o container do
    backend fica "started" (e portanto satisfaz um `depends_on` sem `condition`) durante
    todo o tempo de aplicação das migrations do Drizzle, sem aceitar conexão TCP.
  - `docker-compose.prod.yaml:79-81` declarava `depends_on: [backend, frontend]` na forma
    de lista curta, que equivale a `condition: service_started`. O `Caddyfile:18-24` faz
    `reverse_proxy backend:3000` / `frontend:80`, então nessa janela o proxy de borda já
    está publicado em :80/:443 e responde 502 (connection refused no upstream).
  - Nenhum dos dois serviços tinha `healthcheck`, então também não havia sinal de saúde
    para gatear restart ou alertar — o segundo ponto levantado pela review.
  - Root cause: ausência de healthcheck em `backend`/`frontend` somada a `depends_on` sem
    `condition`, fazendo o Compose tratar "processo iniciado" como "pronto para receber
    tráfego".

### Fix aplicado

- `backend.healthcheck`: probe com o `node` da própria imagem (runtime é `node:22-alpine`,
  ver `backend/Dockerfile:14`) contra `http://127.0.0.1:3000/auth/me`, tratando `401` como
  saudável. Escolha do endpoint: `AuthGuard` é global (`app.module.ts:14`) e sem cookie
  lança `UnauthorizedError` (`AuthGuard.ts:31`), que o `ErrorFilter` mapeia para 401
  (`ErrorFilter.ts:33`) — contrato já fixado pelo teste de integração IT-013
  (`backend/test/integration/auth.test.ts:47`). Um 401 prova processo ouvindo, roteamento
  e cadeia de guards de pé. `start_period: 30s` cobre migrations em banco novo sem gastar
  `retries`.
- Preferi `node -e` a `wget`: o `wget` do busybox sai com código != 0 em resposta 401, o
  que exigiria um wrapper de shell para distinguir "401 esperado" de "não subiu".
- `frontend.healthcheck`: `wget -q -O /dev/null http://127.0.0.1:80/`. O runtime é
  `caddy:2-alpine` (`frontend/Dockerfile:21`) e verifiquei que o binário existe em
  `/usr/bin/wget` na imagem.
- `caddy.depends_on`: convertido para forma de mapa com `condition: service_healthy` nos
  dois upstreams.

### Escopo e testes

- Alteração restrita a `docker-compose.prod.yaml`, o único arquivo de código do batch.
  Não adicionei endpoint `/health` dedicado no backend justamente para não extrapolar o
  escopo — o 401 de `/auth/me` já é um sinal de prontidão suficiente e coberto por teste.
- Não existe harness de teste para arquivos de compose no repositório (nenhuma dependência
  de parser YAML em nenhum workspace), então em vez de introduzir uma dependência nova para
  um teste de schema sintético, a mudança foi verificada executando o stack real com
  Docker (evidência abaixo).

### Verificação

Probes testados isoladamente nas imagens-base reais antes de escrever o compose:

- `node:22-alpine` contra servidor devolvendo 401 -> exit `0`; sem ninguém ouvindo -> exit `1`.
- `caddy:2-alpine` -> `wget` presente em `/usr/bin/wget`.

Stack de produção completo levantado com o smoke test do `DEPLOY.md`
(`SITE_ADDRESS=:80 docker compose -f docker-compose.prod.yaml up -d --build --wait`),
exit `0`. A ordem no log do Compose prova o gate:

```
Container cacau-center-prod-postgres-1  Healthy
Container cacau-center-prod-backend-1   Started
Container cacau-center-prod-backend-1   Waiting
Container cacau-center-prod-frontend-1  Healthy
Container cacau-center-prod-backend-1   Healthy
Container cacau-center-prod-caddy-1     Started   <- só depois dos dois saudáveis
```

Antes da mudança o `caddy` aparecia como `Started` logo após o `backend`, sem o par
`Waiting`/`Healthy` no meio. Tráfego real através do proxy depois de estabilizado:
`GET /api/auth/me` -> `401`, `GET /` -> `200`; `docker inspect` do backend reporta
`healthy` com exit `0` no log do healthcheck.

Pipeline do repositório (após a mudança): `npm run typecheck` exit 0, `npm test` exit 0
(20 arquivos, 142 testes, 0 falhas), `npm run build` exit 0.
