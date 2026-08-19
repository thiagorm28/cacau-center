# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Suíte E2E (Playwright) das 7 jornadas E2E-001–E2E-007. Concluída: `playwright.config.ts`
na raiz (backend 3001 + frontend 5174 + servidor de fixtures 3002), scripts
`test:e2e`/`test:e2e:ui`, harness em `e2e/support/` e 5 specs em `e2e/specs/`.
7/7 passando em ~52s, três execuções verdes consecutivas (uma delas a frio, com o banco
derrubado e os `dist/` apagados).

## Important Decisions

- **Ordem de bipagem no E2E-002**: a trufa (item exclusivo) é bipada **antes** dos 10
  panetones. O `_tests.md` frasea "bipa 10 panetones + 1 trufa", mas o desfecho que ele
  fixa (nota 2 completa, nota 1 com os 10 panetones faltantes) só ocorre nessa ordem —
  é o comportamento que a Task 1 travou por teste em UT-003. Precedência: o desfecho do
  catálogo vence a ordem da frase. Ver risco aberto no `MEMORY.md`.
- **Câmera falsa em vez de entrada manual de código**: não há campo de digitação de
  código na UI, e a bipagem é câmera + ZXing. A suíte substitui só a borda de I/O
  (`navigator.mediaDevices.getUserMedia`) por um `MediaStream` de `<canvas>` onde é
  desenhado um código de barras **ITF real**. O ZXing decodifica pelo caminho de
  produção; nenhum código de app foi alterado.
- **Servidor de fixtures + controle único** (`e2e/support/control-server.ts`, porta 3002):
  serve o `GerarXML` no lugar da API da Cacau Show e expõe `POST /__control/reset`
  (TRUNCATE + resseed de operador/gerente). Um processo só evita coordenar dois.
- **Sem passo de build para o harness**: os arquivos são `.ts` executados direto por
  `node` (type stripping nativo do Node ≥23.6), então o harness continua TypeScript sem
  ganhar um bundler só para isso. Exige imports com extensão `.ts` explícita.
- **`workers: 1` / `fullyParallel: false`**: os testes dividem um único banco e cada um
  o trunca no início.
- **`tsconfig.e2e.json`**: `e2e/` e `playwright.config.ts` não eram cobertos por nenhum
  tsconfig; o `typecheck` da raiz agora encadeia `typecheck:e2e`.

## Learnings

- `canvas.captureStream()` só emite quadro quando o canvas **muda**. Um canvas parado
  deixa a trilha sem quadro nenhum, e o `<video>` fica em 2×2. A câmera falsa repinta
  em intervalo (15 fps) — sem isso, qualquer stream criado depois do último desenho
  nasce morto (foi a causa das falhas de E2E-002/E2E-005 na primeira rodada).
- `getUserMedia` precisa devolver um `MediaStream` **novo por chamada**: o
  `useBarcodeScanner` encerra as trilhas na limpeza do efeito e o StrictMode roda o
  ciclo duas vezes em dev — um stream compartilhado chegava encerrado à segunda montagem.
- O debounce do scanner (1200ms para o mesmo código) obriga a esperar entre bipagens
  repetidas da mesma caixa; `BoxScanner` cuida disso. É o que domina o tempo dos testes
  longos (E2E-001 ~14s, E2E-002 ~17s).
- Depois de cada leitura é obrigatório limpar o canvas, senão o mesmo código é lido de
  novo assim que a janela de debounce fecha.
- `POST /scan-events` e `/scan-events/sync` respondem **200** (`@HttpCode(200)`), não 201.
- Bipagem `unidentified` nasce com `noteId = null` e só entra num relatório via
  `claimUnidentified`, que roda na finalização — o E2E-003 precisa finalizar a nota para
  ver a caixa não identificada listada.
- O Playwright aceita 401 como sinal de "servidor de pé", o que permite usar
  `GET /auth/me` como readiness do backend (não há rota pública de health).

## Files / Surfaces

- `playwright.config.ts`, `tsconfig.e2e.json`, `package.json` (raiz) — novos/alterados.
- `e2e/support/`: `nfeFixtures.ts` (catálogo derivado de `004005647.xml`),
  `control-server.ts`, `database.ts`, `prepare-db.ts`, `fakeCamera.ts`, `fixtures.ts`.
- `e2e/specs/`: 5 arquivos cobrindo E2E-001…E2E-007.
- Nenhum arquivo de `backend/`, `frontend/` ou `shared/` foi modificado.

## Errors / Corrections

- E2E-005 bipava sem esperar a tela de bipagem montar (corrida com a navegação do
  React Router). Corrigido com a espera pelo cabeçalho da nota.
- Primeira tentativa usou um `MediaStream` compartilhado e desenho único no canvas;
  os dois pontos precisaram virar "um stream por chamada" + "repintura contínua".

## Ready for Next Run

- Rodar a suíte exige: Postgres de dev acessível (default
  `postgres://cacau:cacau@localhost:55432/cacau_e2e`, sobrescrevível por
  `E2E_DATABASE_URL`) e `npx playwright install chromium`.
- Neste WSL faltavam as libs de sistema do Chromium (`libnspr4` etc.) e não há sudo:
  a verificação rodou com `LD_LIBRARY_PATH` apontando para os `.deb` extraídos em
  `/tmp/pwdeps/root/usr/lib/x86_64-linux-gnu`. Num ambiente normal,
  `npx playwright install-deps chromium` resolve.
- Follow-up para a Task 5 (deploy/git): quando o repositório virar um repo git,
  ignorar `test-results/` e `playwright-report/`. Hoje não há `.gitignore` algum.
