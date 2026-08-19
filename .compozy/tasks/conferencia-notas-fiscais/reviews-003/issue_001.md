---
provider: manual
pr:
round: 3
round_created_at: 2026-08-19T14:29:48Z
status: resolved
file: backend/src/application/usecase/ApplyScanEvent.ts
line: 64
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Zero-open-notes guard blocks "exceeded" feedback for the common single-note case

## Review Comment

`applyWithin` throws unconditionally when there are no open notes, before the scan is
ever planned:

```ts
const openNotes = await repositories.notes.listOpen();
if (openNotes.length === 0) throw new Error("nenhuma conferência ativa");
```

This guard is correct for the `markUnidentified` path (US-007.EC-2 / UT-027: registering
an unidentified box with no active conferência should be refused). But it also fires for
a *plain* scan (no `manualItemId`, no `markUnidentified`) whenever the only note in the
queue has just auto-completed. The `planExceededOnCompleted` second pass exists
specifically to turn a re-scan of an already-confirmed item into `"exceeded"` feedback
(US-005 AC-1, "quantidade já atingida") instead of an error — but it's only reached from
inside `plan()`, and `plan()` is never called once this guard has already thrown.

For a franqueada that receives one invoice at a time (the most common real case per the
PRD), the sequence is: note completes on its last box → `listOpen()` now returns `[]` →
the very next re-scan of any already-confirmed item on that note throws a raw
`Error("nenhuma conferência ativa")` (mapped to 422) instead of the intended "quantidade
já atingida" warning.

This is confirmed by the test suite: `UT-022a` ("resolve exceeded quando a nota do item
acabou de concluir sozinha", `backend/test/unit/ApplyScanEvent.test.ts:157`) only passes
because a *second* note is deliberately kept open in the fixture, so `openNotes.length`
is 1, not 0. There is no test where the completing note is the only note in the queue —
`UT-027` (`backend/test/unit/ApplyScanEvent.test.ts:297`) only exercises this guard via
`markUnidentified: true`.

Suggested fix: only apply the early guard to the `markUnidentified` path, and let a plain
scan with zero open notes fall through to `planExceededOnCompleted` (which already
tolerates an empty candidate set and returns `"unidentified"` when there's nothing
recently completed to match against):

```ts
const openNotes = await repositories.notes.listOpen();
if (openNotes.length === 0 && input.manualItemId === undefined) {
  if (input.markUnidentified === true) throw new Error("nenhuma conferência ativa");
  const planned = await this.settle(
    repositories,
    await this.planExceededOnCompleted(repositories, input.scannedCode),
    input.operatorId,
  );
  // ... persist as below
}
```
(Adjust `plan()`'s branching so `manualItemId` still works correctly against an empty
`openNotes` array — it already throws its own `NotFoundError` in that case, which is
appropriate.) Add a unit test mirroring UT-022a but with only one note in the fixture to
lock in the fix.

## Triage

- Decision: `VALID`
- Notes:

**Confirmação do bug.** Reproduzido em teste: uma nota única com `expectedQty: 1` conclui na
primeira caixa (US-010), `listOpen()` passa a devolver `[]`, e a rebipagem seguinte batia na
guarda da linha 65 antes de `plan()` — logo `planExceededOnCompleted` nunca rodava. O novo
`UT-022c` falha contra o código anterior (`AssertionError`: esperava `exceeded`, recebeu
`Error("nenhuma conferência ativa")`) e passa com a correção, fechando o ciclo red-green.
`UT-022a` de fato só passava porque a fixture mantinha uma segunda nota aberta.

**Causa raiz.** A guarda misturava duas responsabilidades: recusar o registro manual sem
conferência ativa (US-007.EC-2) e servir de atalho para "fila vazia = nada a resolver". A
segunda premissa é falsa desde que a segunda passada sobre notas recém-concluídas existe.

**Correção aplicada.** A guarda foi movida para *depois* do planejamento, em
`applyWithin`: `plan()` roda sempre (com `openNotes` vazio, `resolveScan` já devolve
`unidentified` e cai em `planExceededOnCompleted`), e a recusa só dispara quando a fila está
vazia **e** o plano resultante é `unidentified`.

**Desvio deliberado da correção sugerida.** A sugestão do review deixava a bipagem comum com
fila vazia gravar um evento `unidentified` órfão. Isso abriria um furo: `claimUnidentified`
(`ScanEventRepository.ts:68`) reivindica *todo* evento `unidentified` com `note_id` nulo, sem
recorte temporal, então uma caixa bipada num período sem conferência seria atribuída à
próxima nota a fechar — exatamente o que US-007.EC-2 evita. A guarda pós-planejamento entrega
o `exceeded` pedido pelo issue sem criar esse evento órfão. `UT-022d` trava esse ponto.

**Efeitos colaterais verificados.**
- `markUnidentified: true` com fila vazia continua lançando `nenhuma conferência ativa`
  (`plan()` devolve `unidentified` → guarda dispara). `UT-027` segue verde.
- `manualItemId` com fila vazia agora lança `NotFoundError("Item não encontrado nas notas em
  conferência")` em vez do erro genérico, como o próprio review indicou ser adequado. Nenhum
  teste existente cobria essa combinação.
- `settle()` só roda depois da guarda, então nenhuma escrita acontece no caminho recusado.

**Escopo.** Alterações em `backend/src/application/usecase/ApplyScanEvent.ts` (arquivo do
batch) e em `backend/test/unit/ApplyScanEvent.test.ts` (testes que validam a correção,
explicitamente em escopo pelo workflow).

**Testes adicionados.**
- `UT-022c resolve exceeded quando a nota concluída era a única da fila` — o caso do issue.
- `UT-022d recusa código desconhecido quando a fila ficou vazia` — protege a recusa restante.
