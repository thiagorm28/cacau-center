---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: frontend/src/hooks/useOfflineQueue.ts
line: 87
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Offline sync discards the whole batch on any non-retryable error

## Review Comment

`SyncScanEvents` (backend) applies each event of a batch in its own `db.transaction`,
in a plain loop — it is not one atomic transaction for the entire array. The frontend's
sync path doesn't account for that partial-application possibility:

```ts
if (payloads.length > 0) {
  try {
    await syncScanEvents(payloads);
    await removeActions(scans.map((entry) => entry.key));
  } catch (error) {
    if (isRetryable(error)) return false;
    await removeActions(scans.map((entry) => entry.key)); // wipes the ENTIRE batch
  }
}
```

If event N in a 10-event batch throws something not covered by `isRetryable` (e.g. a
genuine unexpected 4xx), events `1..N-1` were already committed server-side, but the
HTTP call as a whole rejects, and the `catch` block removes all 10 queued entries from
IndexedDB — including `N+1..10`, which the server never even attempted. Those scans are
permanently lost from the client's perspective with no visible error surfaced
(`UseOfflineQueueResult` exposes no `error`/`lastSyncError` field), silently desyncing
the operator's device from what the manager will later see in history/reports.

Suggested fix: have `syncScanEvents` report per-event outcomes so the client can
discard only the `clientEventId`s that actually received a non-retryable result
(keeping the rest queued for retry), and surface a persistent, visible error state
instead of silently dropping data when events must be discarded.

## Triage

- Decision: `VALID`
- Notes:

**Confirmado no código.** `SyncScanEvents.execute` (`backend/src/application/usecase/SyncScanEvents.ts:35-50`)
percorre `input.events` chamando `this.unitOfWork.run(...)` uma vez por evento — uma transação
por evento, não uma pelo lote. Logo, quando o evento `N` lança um erro não retentável, os
eventos `1..N-1` já estão commitados, o `POST /scan-events/sync` responde erro para a chamada
inteira, e o `catch` do `flush` removia do IndexedDB **todas** as entradas do lote — inclusive
`N+1..10`, que o servidor nunca chegou a processar. Essas bipagens sumiam do aparelho sem
nunca terem sido aplicadas e sem nenhum aviso ao operador.

**Causa raiz:** o cliente tratava a resposta HTTP do lote como um resultado único
("aplicou tudo" ou "recusou tudo"), enquanto o backend aplica o lote parcialmente.

**Correção aplicada** (`frontend/src/hooks/useOfflineQueue.ts`):

1. `replayScans` — quando a sincronização em bloco falha com erro **não** retentável, o lote é
   reenviado bipagem por bipagem via `POST /scan-events` (`sendScanEvent`), na ordem original da
   fila. `ApplyScanEvent.applyWithin` é idempotente por `clientEventId`
   (`backend/src/application/usecase/ApplyScanEvent.ts:51-54`), então reenviar o que já foi
   aplicado devolve `duplicate` em vez de duplicar a bipagem. Cada entrada só sai do IndexedDB
   depois de ter o seu próprio desfecho. Assim, apenas os eventos que o servidor realmente
   recusou são descartados; os demais são aplicados ou permanecem na fila.
2. Um erro retentável no meio do reenvio interrompe o laço (`halted: true`), o `flush` devolve
   `false` e o restante da fila continua intacto para a próxima tentativa agendada.
3. Estado de erro visível: o hook passou a expor `discarded: readonly DiscardedScan[]` e
   `acknowledgeDiscarded()`. A lista não se limpa sozinha — só quando o operador confirma que viu.

**Escolha de escopo — contrato do backend não foi alterado.** A sugestão da review era o
`syncScanEvents` devolver desfechos por evento. Isso mudaria DTO, use case, `types.ts` e o
`client.ts` — bem além dos arquivos deste lote. O reenvio individual resolve exatamente o mesmo
problema (saber qual evento foi recusado) usando um endpoint que já existe e já é idempotente,
sem mudança de contrato, e só entra no caminho raro de recusa definitiva.

**Arquivo fora do escopo tocado (mínimo, justificado):**
`frontend/src/features/scan/ScanScreen.tsx` — um estado de erro que ninguém renderiza continua
sendo perda silenciosa, que é metade do defeito relatado. A mudança se limita a ler `discarded`/
`acknowledgeDiscarded` do hook e exibir um `Banner tone="error"` já existente, com os códigos
recusados e um botão "Entendi". Usa apenas componentes e tokens do DESIGN.md
(`rounded-pill`, `bg-cream-1`, `text-meta`, `text-choc-800`).

**Testes** (`frontend/src/hooks/useOfflineQueue.test.tsx`):

- recusa definitiva no meio do lote descarta só a bipagem recusada (as outras duas são
  reenviadas individualmente e aplicadas) — falha no código antigo, onde `sendScanEvent` nunca
  era chamado e as três entradas eram apagadas;
- erro retentável durante o reenvio individual mantém na fila o que ainda não foi aplicado;
- `acknowledgeDiscarded()` limpa o aviso.
