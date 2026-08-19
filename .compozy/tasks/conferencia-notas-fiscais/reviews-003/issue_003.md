---
provider: manual
pr:
round: 3
round_created_at: 2026-08-19T14:29:48Z
status: resolved
file: frontend/src/hooks/useOfflineQueue.ts
line: 149
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Non-retryable finalize failures are silently discarded, unlike scans

## Review Comment

In `flush()`, the scan-replay path (`replayScans`, line 70) is careful to distinguish
retryable failures (kept in the queue) from terminal ones — terminal scan failures are
pushed into `discarded` and surfaced to the operator via a banner
(`ScanScreen.tsx:108-121`). The file's own comment at lines 47-51 states the design
principle explicitly: "Recusa de regra de negócio é definitiva — mantê-la na fila
travaria todas as ações seguintes."

That principle is not applied to the finalize loop right below it:

```ts
for (const entry of entries) {
  if (entry.action.kind !== "finalize") continue;
  try {
    await finalizeNote(entry.action.noteId, entry.action.confirmIncomplete);
  } catch (error) {
    if (isRetryable(error)) return false;
  }
  await removeActions([entry.key]);
}
```

On a non-retryable error the action is removed from the queue with `removeActions` and
the error is dropped entirely — no `discarded` entry, no banner, nothing. Per US-013.EC-2
(TechSpec), a finalize triggered while offline is queued and applied automatically on
reconnect; per this project's rastreabilidade constraint (PRD: "toda nota finalizada deve
registrar quem a conferiu e quando"), a finalize that silently fails to apply leaves the
note `open` on the server forever while the operator has already navigated past the scan
screen believing the note is closed (`ScanScreen.tsx:57`, `onFinalized(null)`).

`useOfflineQueue.test.tsx`'s coverage of UT-052 only exercises the happy path
(`finalizeNote` mock resolves) — there's no test for a rejected finalize, which is why
this asymmetry with the scan path wasn't caught.

Suggested fix: extend the discard-reporting mechanism to cover finalize actions too, e.g.
broaden `DiscardedScan` to a small discriminated union and surface finalize discards the
same way scan discards are:

```ts
export type DiscardedAction =
  | { kind: "scan"; clientEventId: string; scannedCode: string; reason: string }
  | { kind: "finalize"; noteId: string; reason: string };
```
and push a `{ kind: "finalize", noteId: entry.action.noteId, reason: describeError(error) }`
entry instead of silently discarding on the non-retryable branch.

## Triage

- Decision: `VALID`
- Notes:
  - Confirmado no código: em `flush()`, o laço de finalizações só tratava o ramo
    retentável (`if (isRetryable(error)) return false;`). No ramo não retentável o
    `catch` caía direto no `await removeActions([entry.key])` sem registrar nada —
    assimetria real com `replayScans`, que empurra a recusa definitiva para `discarded`.
  - Impacto confirmado: `ScanScreen.finalize` chama `onFinalized(null)` logo após
    enfileirar, então o operador sai da tela achando que fechou a nota, enquanto no
    servidor ela permanece `open` sem registro de quem conferiu (rastreabilidade do PRD).
  - Causa raiz: o mecanismo de descarte foi modelado só para bipagens (`DiscardedScan`),
    então não havia onde registrar uma finalização recusada.
  - Correção aplicada em `frontend/src/hooks/useOfflineQueue.ts`:
    - `DiscardedScan` ganhou o discriminante `kind: "scan"`; novo `DiscardedFinalize`
      (`kind: "finalize"`, `noteId`, `reason`) e a união `DiscardedAction`, agora o tipo
      exposto por `discarded`.
    - O ramo não retentável do laço de finalização empilha um `DiscardedFinalize` com
      `describeError(error)` antes de remover a ação da fila. O ramo retentável continua
      retornando `false` e mantendo a ação na fila.
  - Arquivo fora do escopo listado: `frontend/src/features/scan/ScanScreen.tsx` — mudança
    mínima e necessária, pois é o único consumidor de `discarded` e o banner lia
    `scan.scannedCode` de toda entrada. Agora separa `discardedScans` de
    `discardedFinalizes` e acrescenta uma linha avisando que a nota continua aberta. Sem
    isso o descarte seguiria invisível ao operador e a correção não teria efeito.
  - Testes adicionados em `frontend/src/hooks/useOfflineQueue.test.tsx`: recusa definitiva
    da finalização (sai da fila e aparece em `discarded`) e erro retentável na finalização
    (permanece na fila, `discarded` vazio, `flush()` retorna `false`). A expectativa do
    teste de descarte de bipagem foi atualizada com `kind: "scan"`.
  - Verificação: `npm run typecheck`, `npm run test` (backend 86 + frontend 48, tudo
    verde) e `npm run build`.
