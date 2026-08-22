# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 concluída (shared: `completionOrder.ts`, `pickQuickScanNote` exportado na raiz).
- task_03 concluída (frontend: `components/ui/PasswordField.tsx`, usado no login e nos
  dois campos da troca de senha; `FIELD` centralizado nele).
- task_02 concluída (backend: `DeleteNote` + `DELETE /notes/:id`). Contrato consumido
  pelo task_04: 204 sem corpo, 404 `"Nota não encontrada"`, 409 `"Nota não está mais em
  conferência"`, 403 fora do papel `operador`, 401 sem sessão.
- task_04 concluída (frontend: fila com exclusão, "Ver produtos"/"Excluir" e "Bipar").
  Todas as tasks do PRD estão concluídas.

## Shared Decisions

- O pacote `shared` é consumido a partir do FONTE em todos os workspaces (alias
  `shared -> shared/src/index.ts` no vitest do backend/shared e no vite do frontend;
  `paths` no tsconfig do frontend/shared). Novo consumo de `shared` não exige rebuild de
  `dist/`, mas `shared/dist/` é versionado e deve ser regerado antes de commitar.

- Specs E2E novas desta feature levam o prefixo da feature
  (`e2e/specs/melhorias-fila-e2e-00N-<slug>.spec.ts`): a numeração `E2E-00x` deste
  catálogo colide com a da suíte de conferência de notas, que já ocupa 001–007.

## Shared Learnings

- Postgres descartável sem Docker, para rodar a suíte de integração do backend:
  `npm pack @embedded-postgres/linux-x64@17.4.0-beta.15`, extrair, recriar os symlinks
  descritos em `native/pg-symlinks.json` (o tarball os achata e o `initdb` quebra com
  `libpq.so.5: cannot open shared object file`), `initdb -U cacau --auth=trust`,
  `pg_ctl -o "-p 5433 -k /tmp" start`, criar o banco `cacau_test` via `pg` e rodar com
  `DATABASE_URL=postgres://cacau:cacau@localhost:5433/cacau_test npx vitest run`.
  O `startTestApp()` aplica as migrations sozinho.

- Playwright roda nesta máquina sem root: Postgres embutido em `localhost:5433`
  (`E2E_DATABASE_URL=postgres://cacau:cacau@localhost:5433/cacau_e2e`) e libs do Chromium
  extraídas com `apt-get download libnspr4 libnss3 libasound2t64` + `dpkg -x`, apontando
  `LD_LIBRARY_PATH=/tmp/chromium-libs/root/usr/lib/x86_64-linux-gnu`. Suíte inteira (19
  testes) verde assim.
- `loginAs`/locators de senha nos E2E precisam de `getByLabel(..., { exact: true })`:
  desde o `PasswordField`, "Senha" também casa com o botão "Mostrar senha".
- O card da fila não é mais clicável inteiro (ADR-003): nos E2E use os helpers
  `queueNoteCard`/`openNoteFromQueue` de `e2e/support/fixtures.ts`, nunca
  `getByRole("button", { name: /Nota X/ })`. Esse locator segue válido só para as
  entradas do histórico, que continuam com o card clicável.

## Open Risks

- Docker continua indisponível (WSL sem integração), mas isso **deixou de bloquear** a
  suíte de integração do backend: ver "Shared Learnings". A E2E do Playwright foi exercitada e está
  verde (ver "Shared Learnings" para a receita sem root).

## Handoffs
