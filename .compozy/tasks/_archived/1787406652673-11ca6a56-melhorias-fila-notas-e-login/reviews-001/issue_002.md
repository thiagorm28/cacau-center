---
provider: manual
pr:
round: 1
round_created_at: 2026-08-22T13:36:07Z
status: resolved
file: frontend/src/features/notes/NotesQueueScreen.tsx
line: 53
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Deleted note can stay visible in the queue if the post-delete reload fails

## Review Comment

US-001.AC-2 requires that, once a delete is confirmed, "a nota some da fila
imediatamente." The implementation relies entirely on a follow-up network round trip to
make that happen:

```ts
// frontend/src/features/notes/NotesQueueScreen.tsx:53-56
const removeNote = async (noteId: string) => {
  await deleteNote(noteId);
  await reload();
};
```

`reload()` (lines 30-38) swallows any failure into a `loadError` banner and leaves the
previous `notes` state untouched:

```ts
const reload = useCallback(async () => {
  try {
    setNotes(await listNotes("open"));
    setLoadError(null);
  } catch {
    setLoadError("Não foi possível atualizar a fila agora.");
  }
}, []);
```

If connectivity drops in the narrow window between the `DELETE /notes/:id` call
succeeding and the subsequent `listNotes("open")` call, the note the operator just
deleted stays rendered in the queue — indefinitely, until some later reload succeeds —
even though the backend has already removed it. This is more than a cosmetic gap in an
app whose core UX is built around exactly this kind of connectivity flakiness
(`useOnlineStatus`, offline queue, etc.): the operator sees a card for a note that no
longer exists, and a subsequent "Ver produtos"/"Excluir" on it will fail unexpectedly
(404) with no obvious cause from the UI's perspective.

Suggested fix: remove the deleted note from local state optimistically, independent of
whether the reload succeeds, e.g.:

```ts
const removeNote = async (noteId: string) => {
  await deleteNote(noteId);
  setNotes((current) => current.filter((note) => note.noteId !== noteId));
  await reload();
};
```

This keeps `reload()`'s existing role (picking up notes opened/changed elsewhere) while
guaranteeing the just-deleted note disappears immediately regardless of the reload's
outcome, matching AC-2 unconditionally rather than only on the happy path (which is all
UT-042 currently exercises).

## Triage

- Decision: `VALID`
- Notes:
  - Confirmado no código: `removeNote` (`NotesQueueScreen.tsx:53-56`) dependia
    exclusivamente do `reload()` seguinte para tirar o card da tela, e `reload()`
    engole a falha num banner mantendo o `notes` anterior intacto (comportamento
    proposital para o modo offline, US-003.AC-3). Root cause: o estado local nunca
    era atualizado a partir do resultado já confirmado do `DELETE /notes/:id`.
  - Impacto real: com a conexão caindo entre o `deleteNote` bem-sucedido e o
    `listNotes("open")`, a nota excluída seguia renderizada indefinidamente e ações
    subsequentes nela retornariam 404 sem causa visível — violando US-001.AC-2, que
    exige que a nota suma da fila imediatamente.
  - Fix aplicado: remoção otimista em `removeNote` (`setNotes(current => current
    .filter(note => note.noteId !== noteId))`) logo após o `deleteNote` resolver,
    antes do `await reload()`. O `reload()` continua no lugar para captar notas
    abertas/alteradas em outros dispositivos. A remoção só ocorre depois que o
    backend confirma a exclusão, então nada some da tela se o `DELETE` falhar.
  - Cobertura: novo teste `UT-042b` em `NotesQueueScreen.test.tsx` — o segundo
    `listNotes` rejeita, o banner "Não foi possível atualizar a fila agora." aparece
    e mesmo assim "Nota 001" sai da fila enquanto "Nota 002" permanece. UT-042 e
    UT-043 (caminho feliz) seguem passando.
