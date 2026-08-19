---
provider: manual
pr:
round: 3
round_created_at: 2026-08-19T14:29:48Z
status: resolved
file: frontend/src/features/scan/useScanSession.ts
line: 89
severity: high
author: claude-code
provider_ref:
---

# Issue 004: A fresh online scan can race ahead of a not-yet-flushed offline queue

## Review Comment

`submit()` decides whether to send a scan directly or enqueue it based solely on
`isOnline`:

```ts
const submit = useCallback(
  async (payload: ScanEventPayload) => {
    if (!isOnline) {
      await enqueue({ kind: "scan", ...payload });
      return;
    }
    try {
      await sendScanEvent(payload);
    } catch {
      await enqueue({ kind: "scan", ...payload });
    }
  },
  [enqueue, isOnline],
);
```

It never checks whether `useOfflineQueue` still has unflushed entries. `ScanScreen.tsx:23-24`
wires `isOnline` from `useOfflineQueue()` into `useScanSession`, but doesn't pass along
`pending`/`isFlushing`. `useOfflineQueue.ts:169-179`'s effect starts an async `flush()` of
the queued batch as soon as `isOnline` flips to `true` — the moment connectivity returns,
`isOnline` is already `true` while the queued batch is still being sent over the network
(`POST /scan-events/sync`, or its per-event replay fallback).

If the operator scans a *new* box in that same window, `submit()` sees `isOnline === true`
and sends it directly via `POST /scan-events` — a second, independent, concurrently
in-flight request racing the batch flush. Whichever request the backend processes first
wins; there's no guarantee it's the chronologically earlier one. `ApplyScanEvent`/
`resolveScan` (ADR-001) allocates ambiguous scans based on the *order* they're applied, so
if the new direct scan is applied before the queued batch finishes, an ambiguous
multi-note allocation (the product's most sensitive business rule, US-009) can be decided
against a stale note-completion snapshot — crediting the wrong note.

No test exercises "a scan made online while a stale queue is still draining"; `useOfflineQueue.test.tsx`
and `useScanSession`'s own tests each treat online/offline and queued/unqueued
independently.

Suggested fix: have `useScanSession` route through `enqueue` (rather than the direct
`sendScanEvent` path) whenever the queue is non-empty, not just when offline — e.g. accept
a `hasPendingQueue` (or `isFlushing`) flag from `useOfflineQueue` and gate `submit` on
`isOnline && !hasPendingQueue`, letting `flush()` own strict ordering of everything ahead
of the new scan:

```ts
if (!isOnline || hasPendingQueue) {
  await enqueue({ kind: "scan", ...payload });
  return;
}
```

## Triage

- Decision: `VALID`
- Notes:
  - Confirmado no código: `useScanSession.submit` decidia só por `isOnline`, e
    `ScanScreen.tsx:23-24` consumia apenas `isOnline`/`enqueue` de `useOfflineQueue`, ignorando
    `pending` e `isFlushing`, que o hook já expõe (`useOfflineQueue.ts:34-44,201`). O efeito de
    `useOfflineQueue.ts:189-199` dispara `flush()` assim que `isOnline` vira `true`, então existe
    de fato uma janela em que `isOnline === true` e o lote antigo ainda está em trânsito.
  - Causa raiz: `isOnline` era usado como proxy de "a fila está vazia". São coisas diferentes —
    a fila também fica cheia com rede de pé (falha 5xx cai na fila em `submit`, e o flush leva
    tempo). Uma bipagem enviada direto nessa janela corre em paralelo com
    `POST /scan-events/sync`, e como `resolveScan` (ADR-001) aloca a bipagem ambígua pela ordem
    de aplicação, a caixa nova podia ser aplicada antes do lote e creditar a nota errada (US-009).
  - Correção aplicada: `useScanSession` passou a receber `hasPendingQueue` e a gatilhar
    `submit` em `!isOnline || hasPendingQueue`, mandando a bipagem para a fila enquanto sobrar
    qualquer coisa nela — o `flush` continua sendo o único dono da ordem de envio.
  - Fora do `<batch_scope>`: `ScanScreen.tsx` precisou da fiação mínima
    (`pending`/`isFlushing` de `useOfflineQueue` → `hasPendingQueue: pending.length > 0 ||
    isFlushing`). `isFlushing` entra na conta porque cobre o instante entre o `readQueue` do
    flush e o `refresh()` que zera `pending`. Nenhuma outra mudança foi feita no arquivo.
  - Teste de regressão em `ScanScreen.test.tsx` ("bipagem feita com rede entra na fila enquanto
    o lote antigo ainda está sendo enviado"): primeira bipagem falha com 503 e cai na fila, o
    `syncScanEvents` é travado num promise controlado para manter a janela aberta, e a segunda
    bipagem é emitida com rede de pé. Ciclo red/green verificado — com o gate revertido para
    `if (!isOnline)` o teste falha (`expected [ '2001' ] to deeply equal [ '2001', '2002' ]`).
