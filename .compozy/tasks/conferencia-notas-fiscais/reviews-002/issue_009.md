---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: frontend/src/hooks/useBarcodeScanner.ts
line: 100
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: In-flight barcode decode isn't cancelled when scanning is disabled

## Review Comment

`ScanScreen` disables the scanner while a dialog is open:

```ts
const scanner = useBarcodeScanner({
  onScan: (code) => void session.handleScan(code),
  enabled: session.unresolvedCode === null && !isFinalizeOpen,
});
```

When `enabled` flips to `false`, the hook's effect cleanup stops the camera tracks and
resets frame-tracking state, but it does not cancel an already-in-flight
`decodeFrame()` call. `decodeFrame` has no reference to the effect's cleanup/cancelled
state, so if a decode was awaiting `readBarcodes(...)` at the exact moment the dialog
opened, its resolution still runs `acceptCode(...)` → `onScanRef.current(code)` →
`session.handleScan(code)` after the camera has nominally stopped and a dialog is
showing. `useScanSession.handleScan` has no guard against running while
`unresolvedCode !== null`, so this can process (and allocate) a scan while
`ManualItemDialog`/`FinalizeDialog` is open. The window is one WASM decode cycle —
narrow, but real, and more likely on the slower/older Android hardware ADR-008
explicitly flags as a risk.

Suggested fix: track a `cancelled` ref shared between the effect and `decodeFrame`, and
check it before calling `acceptCode`/`noteEmptyFrame` after the `await`; additionally
add a defensive guard in `useScanSession.handleScan` to no-op while
`unresolvedCode !== null`.

## Triage

- Decision: `VALID`
- Notes:

**Causa raiz.** `decodeFrame` (`frontend/src/hooks/useBarcodeScanner.ts`) faz `await
readBarcodes(...)` e, na retomada, chama `acceptCode`/`noteEmptyFrame` sem nenhuma
verificação de que a sessão de câmera que originou aquele quadro ainda está viva. O
`cancelled` do efeito é uma variável local do closure do `useEffect`; `decodeFrame` é um
`useCallback` fora desse closure e não tem como enxergá-la. Resultado: com `enabled`
indo para `false` durante o `await` (diálogo abrindo em `ScanScreen`), o `onScan`
dispara depois que as tracks já foram paradas — janela de um ciclo de decodificação
WASM, mais larga justamente no hardware Android lento que a ADR-008 sinaliza como risco.

**Correção aplicada.** Contador de sessão em `sessionRef`, incrementado no cleanup do
efeito. `decodeFrame` captura o valor antes do `await` e descarta o resultado se o
contador mudou. Optei pelo contador em vez de um booleano `cancelled` compartilhado
porque ele também cobre o caso desabilita→reabilita rápido: com booleano, uma
decodificação da sessão antiga que resolvesse já dentro da sessão nova seria aceita como
leitura válida (e o `inFrameRef` foi zerado no cleanup, então nem a deduplicação a
seguraria). O contador identifica a sessão, não só "está ativo".

**Escopo.** O guard defensivo sugerido em `useScanSession.handleScan` não foi feito:
`frontend/src/features/scan/useScanSession.ts` está fora dos arquivos deste batch, e a
correção no hook já fecha a janela descrita — nenhum `onScan` é emitido depois que a
sessão termina. Fica registrado como defesa em profundidade opcional para uma rodada
futura.

**Teste.** `useBarcodeScanner.test.tsx`: "desabilitar o scanner descarta a decodificação
que ainda estava em voo" — `readBarcodes` fica pendente numa promise controlada, o
harness re-renderiza com `enabled={false}` e só então a decodificação resolve com um
código válido; espera-se `onScan` não chamado. Ciclo red/green verificado: removendo a
linha do guard o teste falha (1 failed | 7 passed), com o guard passa (8 passed).

**Nota de verificação.** Uma execução de `npm run test` na raiz acusou 6 falhas no
frontend, todas `Test timed out in 5000ms` no primeiro teste de 6 arquivos distintos —
incluindo `useOfflineQueue`, `ScanRoute`, `NoteSearchForm` e `ReportScreen`, que esta
mudança não toca. Reexecuções da suíte do frontend (paralela e com `--poolOptions.forks.singleFork`)
e da suíte completa passaram integralmente; é a intermitência conhecida da suíte sob
carga, não regressão.
