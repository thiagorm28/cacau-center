---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: e2e/support/database.ts
line: 7
severity: high
author: claude-code
provider_ref:
---

# Issue 002: E2E suite needs a Postgres nothing in the repo provisions

## Review Comment

`npm run test:e2e` fails out of the box on a clean checkout: `DEFAULT_DATABASE_URL`
in `e2e/support/database.ts:7` points at
`postgres://cacau:cacau@localhost:55432/cacau_e2e`, but nothing in the repository
starts a Postgres server on port `55432`. `e2e/support/control-server.ts` and
`e2e/support/prepare-db.ts` only *create the database* on an already-running server
(`ensureDatabase`) — they never start Postgres itself. The dev `docker-compose.yaml`
maps Postgres to host port `5432`, not `55432`, and there is no CI workflow or compose
service targeting `55432` anywhere in the repo.

`CLAUDE.md`'s documented E2E steps ("`npm install` na raiz, `npx playwright install
chromium`, `npm run test:e2e`") are the only instructions given to a new contributor,
and following them literally on a clean machine fails with `ECONNREFUSED`. The task's
own workflow memory (`.compozy/tasks/conferencia-notas-fiscais/memory/task_04.md`)
confirms this was worked around ad hoc during development ("Postgres de dev
acessível... default `localhost:55432`") without ever wiring up how a fresh
environment is supposed to get one running there.

Suggested fix: add a dedicated Postgres service for E2E (e.g. a
`docker-compose.e2e.yaml`, or a `postgres` service block mapped to `55432`) and
reference it explicitly in `CLAUDE.md`'s E2E section, or simplify by pointing
`DEFAULT_DATABASE_URL` at the existing dev Postgres on `5432` with a distinct
database name and documenting that dependency.

## Triage

- Decision: `VALID`
- Notes:
  Confirmado na árvore. `grep -rn "55432"` só encontra `e2e/support/database.ts:7`,
  `playwright.config.ts:12` e arquivos de memória/review — nenhum serviço de compose,
  nenhum workflow de CI e nenhum `.github/workflows` (o diretório não existe) provisiona
  Postgres nessa porta. Reproduzido antes da correção: `ensureDatabase()` num host sem
  o banco falhava com `ECONNREFUSED` cru, sem indicar o que provisionar.

  Causa raiz: a suíte assume uma dependência de infraestrutura (Postgres descartável em
  `55432`) que nunca foi materializada no repositório — ela existia só na máquina de
  desenvolvimento, como o próprio `memory/task_04.md` registra.

  Correção aplicada (primeira opção sugerida pelo revisor, não a segunda): manter a
  porta dedicada e provisioná-la de verdade, porque apontar para o Postgres de dev em
  `5432` quebraria a garantia que o comentário de `database.ts` faz — cada teste roda
  `TRUNCATE ... CASCADE`, então compartilhar servidor com o banco de trabalho é um risco
  de perda de dados mesmo com nome de banco distinto.

  1. `docker-compose.e2e.yaml` (novo): serviço `postgres-e2e` mapeado em `55432:5432`,
     projeto próprio (`name: cacau-center-e2e`) para não colidir com o `postgres` do
     compose de desenvolvimento, `tmpfs` no diretório de dados (estado efêmero, que é
     exatamente a semântica que a suíte já assume) e `healthcheck` para o `--wait`.
  2. `e2e/support/database.ts` (arquivo em escopo): `connectOrExplain` converte a falha
     de conexão na instrução de provisionamento, preservando o erro original em `cause`.
     É o ponto certo para isso porque `ensureDatabase` é o primeiro contato da suíte com
     o banco — tanto no `prepare-db` quanto no `control-server`.
  3. `package.json` e `CLAUDE.md` (fora da lista de arquivos em escopo, mudança mínima
     e deliberada): o revisor pediu explicitamente que a dependência fosse referenciada
     na seção de E2E do `CLAUDE.md`, e a documentação precisa de um comando real para
     citar. Adicionados `e2e:db:up`/`e2e:db:down` e a sequência documentada atualizada.
     Nenhuma outra parte desses arquivos foi tocada.

  Sem teste unitário novo: a correção é de provisionamento de infraestrutura, e a
  evidência que a valida é a própria suíte E2E subindo contra o container — verificado
  abaixo. O repositório não tem harness de teste na raiz para `e2e/support/`, e criar um
  só para esta correção seria menos evidência, não mais.

  Falha de ambiente pré-existente, não relacionada à correção: nesta máquina o Chromium
  do Playwright não inicia (`libnss3`, `libnspr4`, `libasound2` ausentes no host; instalar
  exige root, indisponível na sessão), então os 7 specs falham no *launch do navegador*,
  antes de qualquer asserção. A metade de banco de dados — que é o objeto desta issue —
  foi verificada diretamente e passa: os três `webServer` sobem, as migrations do backend
  aplicam o schema em `cacau_e2e` (`invoice_notes`, `note_items`, `scan_events`, `users`)
  e `POST /__control/reset` responde `204` semeando `operador@loja.com` e
  `gerente@loja.com`. O gap de bibliotecas do navegador ficou documentado no `CLAUDE.md`,
  já que atinge o mesmo "clean checkout" descrito pelo revisor.
