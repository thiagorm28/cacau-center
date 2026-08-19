---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: frontend/src/routes/ScanRoute.tsx
line: 19
severity: high
author: claude-code
provider_ref:
---

# Issue 003: PWA can't resume scanning after a reload while offline

## Review Comment

`ScanRoute` unconditionally fetches `listNotes("open")` from the network on mount and,
if that call fails, renders a hard error screen instead of `ScanScreen`:

```tsx
useEffect(() => {
  let active = true;
  listNotes("open")
    .then((open) => { if (active) setNotes(open); })
    .catch(() => { if (active) setError("Não foi possível carregar as notas em conferência."); });
  return () => { active = false; };
}, []);

if (error !== null) {
  return (
    <Screen title="Bipagem">
      <Banner tone="error">{error}</Banner>
    </Screen>
  );
}
```

There is no local persistence of the note/item snapshot (`expectedQty`/`confirmedQty`
per item) that `resolveScan` needs to keep operating offline: the only IndexedDB store
in the app (`frontend/src/offline/queueStore.ts`) holds the *scan-event queue*, not note
state, and the service worker's `runtimeCaching` (`vite.config.ts`) only precaches
static build assets — there's no cache entry for `GET /notes`.

Net effect: if the operator's PWA is reloaded or killed while offline (the exact
scenario ADR-003/US-013 exist for — "progresso de bipagem já realizado permanece salvo
localmente ao reabrir o app"), `ScanRoute` cannot render the scanner at all. Already-
queued scan events are safe in IndexedDB and sync fine once the round trip through
`listNotes` succeeds, but until then the operator is stuck on an error screen with no
way to keep scanning. `NotesQueueScreen` degrades more gracefully (it shows a
"Não foi possível atualizar a fila agora" banner and keeps whatever it already has in
memory instead of hard-failing), but `ScanRoute` — the screen actually used while
scanning boxes — does not.

Suggested fix: persist the last-fetched `NoteView[]` (or at minimum the currently
active note) to IndexedDB/localStorage, and have `ScanRoute` fall back to that cache
when the network fetch fails, refreshing it opportunistically whenever a fetch
succeeds.

## Triage

- Decision: `VALID` — confirmado no código e corrigido neste batch.
- Status: `resolved`.

### O que foi confirmado

O relato procede em todos os pontos. `ScanRoute` tinha um único caminho de dados
(`listNotes("open")`) e o `catch` levava direto ao `Banner` de erro, sem nenhuma
alternativa local. As três fontes de estado offline citadas foram verificadas:

- `frontend/src/offline/queueStore.ts` guarda só `pending-actions` (bipagens e
  finalizações a enviar) — nada sobre `expectedQty`/`confirmedQty` das notas.
- `vite.config.ts` usa `globPatterns` de assets estáticos + `navigateFallback`; não há
  `runtimeCaching` para `GET /notes`.
- `NotesQueueScreen` de fato degrada melhor (mantém a lista em memória e mostra banner
  informativo), enquanto `ScanRoute` falhava duro.

O buraco também aparece no contrato de testes: `_tests.md` UT-051 cobre apenas
"eventos enfileirados continuam presentes após o reload", nunca o estado das notas que a
tela precisa para renderizar. Por isso US-013.EC-1 passava verde sem estar coberto.

### Root cause

`GET /notes` era a única origem possível do snapshot de notas, e ela depende de rede.
Sem persistência local desse snapshot, US-013.EC-1 ("progresso de bipagem já realizado
permanece salvo localmente ao reabrir o app") era inalcançável por construção.

### Correção aplicada

1. **`frontend/src/offline/noteSnapshotStore.ts` (novo).** Retrato das notas em
   conferência em IndexedDB, com `readOpenNotes`/`saveOpenNotes`. Fica num banco próprio
   (`cacau-center-notes`), e não no da fila, para não versionar o schema das bipagens
   pendentes a partir de outro módulo — duas conexões `idb` no mesmo banco com
   `upgrade` diferentes se atropelariam. Leitura valida a forma do que voltou: um
   retrato gravado por versão anterior do app é descartado em vez de montar a tela com
   dados pela metade. Nenhuma das duas funções propaga erro — perder o retrato degrada o
   modo offline, não a bipagem em curso.
2. **`frontend/src/routes/ScanRoute.tsx`.** Salva o retrato a cada carga bem-sucedida e,
   no `catch`, cai para o retrato local; a tela de erro só aparece quando não existe
   retrato nenhum. O retrato **não** é usado para semear o estado inicial de propósito:
   `useScanSession` fixa as notas na montagem e ignora mudanças posteriores da prop, então
   renderizar o cache antes da resposta congelaria a sessão em dados velhos mesmo online.
3. **`frontend/src/features/scan/useScanSession.ts`** (fora da lista de arquivos do
   batch — justificativa abaixo). Um `useEffect` grava o retrato a cada mudança de
   `notes`.

### Por que `useScanSession.ts` precisou ser tocado

Persistir apenas a resposta do `GET /notes`, como a review sugere, resolveria a tela de
erro mas introduziria um problema pior: as bipagens feitas offline existem **só** na fila
e no estado da sessão. Um reload sem rede reabriria a bipagem com os contadores da última
carga online — o operador veria caixas já bipadas como pendentes e as biparia de novo,
gerando eventos novos (`clientEventId` novo, portanto não idempotentes) e excedentes no
relatório. Servir um retrato desatualizado é uma regressão de integridade, não uma
degradação aceitável. A mudança é um único `useEffect` de duas linhas, sem alteração de
comportamento da sessão.

### Testes

- `frontend/src/routes/ScanRoute.test.tsx` (novo, 4 casos): grava o retrato na carga
  bem-sucedida; sem rede reabre a bipagem pelo retrato em vez do erro (US-013.EC-1);
  sem rede e sem retrato ainda avisa a falha (comportamento anterior preservado);
  retrato fora do formato esperado é ignorado.
- `frontend/src/features/scan/ScanScreen.test.tsx`: novo caso US-013.EC-1 provando que o
  retrato acompanha a bipagem (1/3 gravado após bipar), não a resposta do servidor.
- Red-green verificado: com o `catch` original e o `useEffect` removidos, exatamente os
  dois casos novos de US-013.EC-1 falham; os 11 pré-existentes seguem verdes.

### Limitação conhecida (não corrigida)

Se a busca falhar **online** (ex.: 500 do servidor), a tela também monta pelo retrato,
sem sinalizar ao operador que os dados podem estar velhos. Um aviso exigiria uma prop
nova em `ScanScreen`, que é quem detém o `Screen`. Fora do escopo desta issue.

### Verificação

Postgres do `docker-compose.yaml` no ar (`pg_isready` OK), a partir da raiz do repo:

- `npm run typecheck` (shared + backend + frontend + e2e) → 0 erros.
- `npm run test` → shared 12/12, backend 73/73, frontend 35/35 — 120 testes, 0 falhas.
- `npm run build` (shared + frontend) → exit 0, service worker gerado.
