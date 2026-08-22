---
provider: manual
pr:
round: 1
round_created_at: 2026-08-22T13:36:07Z
status: resolved
file: backend/src/application/usecase/DeleteNote.ts
line: 32
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Delete log omits the operator, contradicting the TechSpec's audit intent

## Review Comment

`_techspec.md`'s "Monitoring and Observability" section states explicitly:

> `DeleteNote` logs at the same level `FinalizeNote`/`ApplyScanEvent` already use... on
> successful deletion, **including `noteId` and the acting `operatorId`** — the only
> durable trace of a note's existence once deleted, since no audit record is kept (PRD,
> ADR-001).

Because ADR-001 mandates a hard delete with no soft-delete/audit trail, this log line is
called out as the *only* place a note's deletion (and who performed it) is ever
recorded. The implementation only logs the `noteId`:

```ts
// backend/src/application/usecase/DeleteNote.ts:32
this.logger.log(`Nota ${note.noteId} excluída em conferência`);
```

`DeleteNote.Input` (line 5) has no `operatorId` field, and the route that calls it,
`NoteController.remove` (`backend/src/infra/controller/NoteController.ts:81-83`), never
injects `@CurrentUser()` — unlike every other authenticated note action
(`create`, `finalize`), which already do. So there is currently no way to know, after the
fact, which operator deleted a given note — exactly the gap ADR-001's own "Risks" section
flags as needing mitigation ("a nota que outro operador está bipando... comunicar que a
nota sumiu").

Suggested fix: thread `operatorId` through the same way `finalize` already does —

```ts
// NoteController.ts
@Roles("operador")
@Delete(":id")
@HttpCode(204)
async remove(
  @Param("id", noteIdParam()) noteId: string,
  @CurrentUser() user: SessionUser,
): Promise<void> {
  await this.deleteNote.execute({ noteId, operatorId: user.userId });
}
```

and log `Nota ${note.noteId} excluída em conferência por ${input.operatorId}` inside
`DeleteNote.deleteWithin`.

## Triage

- Decision: `VALID`
- Notes:

Confirmado no código e na spec. `_techspec.md:247-250` ("Monitoring and Observability")
exige que o log de sucesso do `DeleteNote` inclua `noteId` **e** o `operatorId` que
executou a ação, justamente porque ADR-001 manda hard delete sem trilha de auditoria —
esse log era o único rastro. A implementação em `DeleteNote.ts:32` logava só o `noteId`,
e `NoteController.remove` (`NoteController.ts:81-83`) não injetava `@CurrentUser()`,
diferente de `create` e `finalize`. Logo, não havia como saber quem excluiu uma nota.

Causa raiz: `DeleteNote.Input` não carregava `operatorId`, então a informação nem chegava
ao usecase.

Correção aplicada:

- `backend/src/application/usecase/DeleteNote.ts` — `Input` passa a ser
  `{ noteId: string; operatorId: string }` e o log virou
  `Nota ${note.noteId} excluída em conferência por ${input.operatorId}`.
- `backend/src/infra/controller/NoteController.ts` (fora da lista de arquivos do batch,
  mudança mínima e inevitável: o `operatorId` só existe na sessão HTTP) — `remove` agora
  recebe `@CurrentUser() user: SessionUser` e repassa `operatorId: user.userId`, no mesmo
  padrão já usado por `finalize`.
- `backend/test/unit/DeleteNote.test.ts` — chamadas existentes atualizadas para o novo
  `Input` e novo teste de regressão (`REV-001`) que espiona `Logger.prototype.log` e
  garante que a linha de log carrega `noteId` e `operatorId`.

Observações sobre a spec:

- O snippet "Core Interfaces" do `_techspec.md:66` e os enunciados UT-001–UT-005 do
  `_tests.md` descrevem `Input = { noteId }`, contradizendo a seção de observabilidade da
  própria TechSpec. A contradição foi resolvida a favor da observabilidade, que é o
  requisito funcional (sem ele o rastro exigido por ADR-001 não existe); o comportamento
  observável coberto por UT-001–UT-005 e IT-001–IT-011 permanece idêntico. Os documentos
  de spec não foram editados por estarem fora do escopo deste batch.
- O teste de regressão foi nomeado `REV-001` e não `UT-006` porque `UT-006` já está
  atribuído a `completionOrder.ts` no `_tests.md`.

Verificação (raiz do repo, Postgres portátil em `5433`):

- `npm run typecheck` — shared, backend, frontend e e2e sem erros.
- `npm run test` — shared 26, backend 174 (inclui os 11 IT de exclusão), frontend 148;
  0 falhas.
- `npm run build` — exit 0.
