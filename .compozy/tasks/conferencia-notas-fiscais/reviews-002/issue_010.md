---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: frontend/src/session/SessionContext.tsx
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: Expired session never prompts re-login; queued sync retries 401 forever

## Review Comment

`useOfflineQueue.isRetryable` treats `401`/`403` as retryable:

```ts
const isRetryable = (error: unknown): boolean =>
  error instanceof NetworkError ||
  (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status >= 500));
```

but nothing in `SessionContext` (or anywhere else in the client) listens for a 401
response to reset `status`/`user` back to `"anonymous"`. Once the 8h session expires
mid-conference, `useOfflineQueue`'s auto-retry (`RETRY_DELAY_MS = 5000`) keeps calling
`syncScanEvents`/`finalizeNote` every 5 seconds, always getting 401, forever — silently,
with no prompt for the operator to log back in. This directly misses half of
US-015.EC-2 ("Sessão expirada... operador é solicitado a autenticar novamente, sem
perder o progresso"): the progress is preserved (good — the queue isn't drained on
401), but the "solicitado a autenticar novamente" half never happens, so the operator
has no idea their scans have stopped syncing.

Suggested fix: on a 401 from any API call, have the client (e.g. in `api/client.ts`'s
`request()`) invoke a session-invalidation callback that `SessionContext` exposes, so
the UI can prompt re-login while keeping the local queue intact for the retry to
succeed once the operator signs back in.

## Triage

- Decision: `VALID`
- Notes:
  - Confirmado no código: `isRetryable` (`frontend/src/hooks/useOfflineQueue.ts:53`) mantém
    `401` na fila, e `grep` por `401` no `frontend/src` só encontra esse ponto — nenhum
    consumidor observa a expiração da sessão. `SessionContext` só troca de estado no
    `GET /auth/me` da montagem, no `signIn` e no `signOut`, então uma sessão que expira com
    o app já aberto deixa `status: "authenticated"` para sempre e o efeito de retentativa
    de `useOfflineQueue` (`RETRY_DELAY_MS = 5000`) recebe `401` indefinidamente, em silêncio.
  - Causa raiz: o 401 é visível apenas no cliente HTTP (`frontend/src/api/client.ts`), que
    não tem como avisar a camada de sessão; não existe canal entre os dois.
  - Correção: `client.ts` passa a expor `setSessionExpiredListener` e a notificá-lo em
    qualquer resposta `401`; `SessionContext` registra esse ouvinte **somente enquanto está
    autenticado** e, ao ser chamado, volta para `anonymous` com `expired: true`. O recorte
    por estado é necessário porque `POST /auth/login` com senha errada e o `GET /auth/me` da
    carga inicial também respondem `401` (`ErrorFilter.statusOf` mapeia `UnauthorizedError`
    para 401) — sem ouvinte registrado nesses momentos, eles não são confundidos com
    expiração. Com `user === null`, o `App` já renderiza a `LoginScreen`, o que desmonta a
    `ScanScreen` e encerra o laço de retentativas; a fila continua intacta no IndexedDB e
    volta a drenar sozinha no próximo login.
  - Arquivos fora do `<batch_scope>`: `frontend/src/api/client.ts` (único lugar que enxerga
    o status HTTP, mínimo necessário para o canal existir) e
    `frontend/src/features/auth/LoginScreen.tsx` (a metade "solicitado a autenticar
    novamente" da US-015.EC-2 exige dizer ao operador *por que* ele voltou ao login e que o
    progresso foi guardado). Ambas as mudanças são aditivas e restritas ao fluxo de expiração.

## Resolução

- `frontend/src/api/client.ts`: `setSessionExpiredListener(listener | null)` e notificação do
  ouvinte em toda resposta `401` dentro de `request()`, antes de lançar o `ApiError` — o
  comportamento de erro das chamadas não muda.
- `frontend/src/session/SessionContext.tsx`: novo campo `expired` no contexto e efeito que
  registra o ouvinte apenas com `status === "authenticated"`, voltando a sessão para
  `anonymous` + `expired: true` quando o 401 chega. `signIn` e `signOut` limpam `expired`.
- `frontend/src/features/auth/LoginScreen.tsx`: aviso ("Sua sessão expirou. Entre novamente
  para continuar — as bipagens pendentes foram guardadas.") em `Banner tone="warning"`,
  suprimido quando já há erro de credencial na mesma tela.
- Laço de retentativa: com `user === null` o `App` troca para a `LoginScreen`, a `ScanScreen`
  desmonta e o efeito de retentativa de `useOfflineQueue` é encerrado — fim do 401 a cada 5s.
  A fila continua no IndexedDB e drena sozinha depois do novo login.

### Testes

`frontend/src/session/SessionContext.test.tsx` (novo, 5 casos, conversando com o `fetch`
global para exercitar o elo real `client.ts` ↔ `SessionContext`):

- 401 em chamada autenticada derruba a sessão e mostra o pedido de novo login;
- novo login limpa o aviso e devolve o operador ao app;
- 401 do `GET /auth/me` da carga inicial não é tratado como expiração;
- 401 de senha errada mostra só "E-mail ou senha inválidos";
- `signOut` volta ao login sem o aviso de expiração.

Ciclo vermelho→verde conferido: removendo a notificação de 401 em `client.ts`, os dois
primeiros casos falham (`2 failed | 3 passed`); com a correção, `5 passed`.

### Verificação

- `npm run typecheck` — exit 0 (backend, frontend, e2e).
- `npm run test` — exit 0: backend 84 testes / 11 arquivos, frontend 46 testes / 8 arquivos.
- `npm run build` — exit 0 (shared, backend, frontend + PWA).
- `npm run test:e2e` — **não executável nesta máquina**: os 7 specs falham no lançamento do
  Chromium (`libnspr4.so: cannot open shared object file`), antes de qualquer código do app.
  É a limitação de ambiente já documentada no `CLAUDE.md` da raiz (`npx playwright install
  --with-deps chromium` pede root); é anterior e alheia a esta correção.
