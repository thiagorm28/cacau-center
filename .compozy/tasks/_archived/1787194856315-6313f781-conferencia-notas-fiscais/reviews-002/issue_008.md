---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: frontend/src/features/scan/useScanSession.ts
line: 80
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: Online scan submission silently swallows non-network API errors

## Review Comment

```ts
const submit = useCallback(async (payload: ScanEventPayload) => {
  if (!isOnline) { await enqueue({ kind: "scan", ...payload }); return; }
  try {
    await sendScanEvent(payload);
  } catch (error) {
    if (error instanceof NetworkError) await enqueue({ kind: "scan", ...payload });
  }
}, [enqueue, isOnline]);
```

The local optimistic UI state is already updated before `submit` runs. If
`sendScanEvent` throws an `ApiError` that isn't a `NetworkError` (a transient 500, or
any unexpected 4xx), the error is silently discarded here: it's neither retried nor
queued, and produces no user feedback. This is inconsistent with
`useOfflineQueue.isRetryable`, which treats 5xx (and 401/403) as retryable elsewhere in
the same codebase — showing the narrower handling here isn't an intentional design
choice. The result is a scan the operator believes is confirmed (the UI already
incremented the counter) but that the server never recorded, with no signal to anyone
until a manager later notices a mismatch in the divergence report.

Suggested fix: route non-network `ApiError`s through the same retry/queue path used for
`NetworkError` (or at minimum surface an explicit "falha ao confirmar, será reenviado"
banner) instead of only special-casing `NetworkError`.

## Triage

- Decision: `VALID`
- Notes:

Confirmado no código. `submit` (`frontend/src/features/scan/useScanSession.ts:89`) só
tratava `NetworkError`; qualquer `ApiError` caía no `catch` vazio e sumia. A tela já
tinha incrementado o contador em `confirmItem` antes do `await submit(payload)`, então
um 503 transitório produzia exatamente o cenário descrito: caixa contada para o
operador, nunca gravada no servidor, sem retentativa e sem aviso.

A inconsistência com `useOfflineQueue.isRetryable`
(`frontend/src/hooks/useOfflineQueue.ts:52`) é real — lá 401/403/5xx são retentáveis, e
recusa definitiva vira `DiscardedScan`, que a `ScanScreen` já renderiza como banner
"O servidor recusou N bipagens".

Causa raiz: o envio online decidia sozinho o que era recuperável, em vez de delegar
essa classificação à fila, que é onde ela já existe.

Correção aplicada: no caminho online, **toda** falha de `sendScanEvent` passa a
enfileirar a bipagem (`await enqueue({ kind: "scan", ...payload })`), sem inspecionar o
tipo do erro. A fila é o único ponto que sabe separar falha temporária de recusa
definitiva: `flush` retenta a primeira (com `RETRY_DELAY_MS`) e `replayScans` converte
a segunda em `discarded`, que já chega ao operador pelo banner existente. Isso entrega
as duas coisas pedidas na review — retentativa **e** feedback explícito — sem duplicar
`isRetryable` nem criar uma segunda regra de classificação que voltaria a divergir.

Escopo: a mudança ficou inteiramente em `frontend/src/features/scan/useScanSession.ts`
(o import de `NetworkError`, agora sem uso, foi removido). Nenhum arquivo fora do
`<batch_scope>` foi alterado além do próprio arquivo de teste
`frontend/src/features/scan/ScanScreen.test.tsx`, que cobre o hook.

Testes adicionados em `ScanScreen.test.tsx` (ambos verificados falhando contra o código
anterior e passando com a correção):
- erro 503 no envio online preserva a bipagem na fila em vez de descartá-la;
- recusa definitiva (422) chega ao operador como "O servidor recusou 1 bipagem".
