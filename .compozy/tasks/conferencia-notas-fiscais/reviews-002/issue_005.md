---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: backend/src/application/usecase/ApplyScanEvent.ts
line: 112
severity: high
author: claude-code
provider_ref:
---

# Issue 005: Auto-completed note's unidentified scans/closedBy stay unset until it's separately finalized

## Review Comment

When a note reaches 100% automatically, `ApplyScanEvent.confirmBox` only marks it
`completed`:

```ts
private async confirmBox(repositories: Repositories, planned: PlannedScan, itemId: string) {
  await repositories.notes.incrementConfirmedQty(itemId);
  const note = planned.note;
  if (note === undefined) return;
  note.findItem(itemId)?.confirmOneBox();
  if (note.isFullyConfirmed()) {
    note.markCompleted();
    await repositories.notes.updateStatus(note.noteId, "completed");
  }
}
```

It never sets `closedBy`/`closedAt` and never claims pending `unidentified` scan events
for the note. `FinalizeNote.finalizeWithin` does have a branch for exactly this case
(`else if (note.getClosedAt() === null)`) that sets `closedBy`/`closedAt` and calls
`scanEvents.claimUnidentified` — and the normal UI path does reach it: in
`ScanScreen.tsx`, once `isNoteComplete` is true the primary button becomes "Ver
relatório da nota" and calls `finalize()`, which hits `POST /notes/:id/finalize` and
runs that branch correctly.

The gap is that this only happens if the operator actually revisits that specific note
and taps through to the report. If they scan the last box of a note and then navigate
away (open another note in the queue, background/close the app, or simply never click
back into that note), the note is left indefinitely in `completed` status with
`closedBy`/`closedAt` still `null` and any `unidentified` scans recorded during that
note's session unclaimed — they'll instead be silently attributed to whichever
unrelated note happens to be finalized next, and the history/report won't show who
closed this note or when (undermining the ADR-004/US-016 traceability goal:
"toda nota finalizada deve registrar quem a conferiu e quando"). `GetNoteReport` also
happily serves the divergence report for such a note without ever running the
claim/closedAt logic, so a manager could view an incomplete report (missing
unidentified boxes) if they get to it before the operator's device does. No existing
test (`history-report.test.ts`'s IT-016 only covers the explicit `closed_incomplete`
path) catches this.

Suggested fix: have `ApplyScanEvent.confirmBox` also call `claimUnidentified` and set
`closedAt`/`closedBy` (using the scanning operator) at the moment a note auto-completes,
so the note is fully closed the instant it reaches 100% rather than only when someone
later happens to view its report.

## Triage

- Decision: `VALID`
- Notes:

**Confirmação técnica.** `ApplyScanEvent.confirmBox` chamava apenas
`notes.updateStatus(noteId, "completed")`, que não toca em `closed_by`/`closed_at` nem
reivindica as bipagens `unidentified` órfãs. O teste vermelho reproduziu exatamente os
três sintomas descritos (rodando a suíte do backend contra o código pré-correção):

- `UT-020a` — nota `completed` com `getClosedBy()`/`getClosedAt()` nulos.
- `UT-020b` — a bipagem `unidentified` da sessão continuava com `note_id` nulo.
- `IT-030` — `GET /notes/:id/report` respondia 200 com `closedAt: null` e
  `unidentifiedScans: []` sem nenhuma chamada a `/finalize`, e o histórico do gerente
  mostrava `closedByName: null`.

**Causa raiz.** A conclusão automática (US-010) estava modelada como uma simples
transição de status à espera de um fechamento explícito posterior, enquanto
`FinalizeNote.finalizeWithin` concentrava o fechamento real (autoria + `claimUnidentified`)
no ramo `else if (note.getClosedAt() === null)`. Esse ramo só roda se o operador voltar
à nota e abrir o relatório — um passo de UI opcional.

**Correção.** `confirmBox` agora delega a `closeCompleted`, que grava
`closedBy`/`closedAt` com o operador da bipagem via `notes.close(noteId, "completed", ...)`
e chama `scanEvents.claimUnidentified(noteId)` no mesmo instante em que a nota atinge
100% — tudo dentro da transação já aberta por `applyWithin` (ADR-007). O ramo de
`FinalizeNote` continua no lugar como rede de segurança para notas legadas e segue
idempotente, porque só age enquanto `closedAt` for nulo (coberto por `UT-031a`).

**Arquivos fora do escopo do batch.** `notes.updateStatus` ficou sem nenhum chamador
depois da troca por `notes.close`, então foi removido da interface e da implementação em
`backend/src/infra/repository/NoteRepository.ts` e do dublê em
`backend/test/support/InMemoryRepositories.ts`. É código morto criado por esta própria
correção; nenhuma outra alteração foi feita nesses arquivos.

**Cobertura adicionada.** `UT-020a`, `UT-020b` e `UT-020c` (não fecha enquanto restar
item pendente) em `backend/test/unit/ApplyScanEvent.test.ts`; `UT-031a` em
`backend/test/unit/FinalizeNote.test.ts`; `IT-030` em
`backend/test/integration/notes-lifecycle.test.ts`. Ciclo red-green verificado: as quatro
asserções novas falham contra o código pré-correção e passam depois dela.
