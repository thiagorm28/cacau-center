# Test Specification: Melhorias na fila de notas e no login

Canonical test contract for excluir nota em conferência, bipagem rápida pela fila, ações
explícitas do card da fila, e ver senha no login e na troca de senha. Companion to
`_techspec.md`. Derived from `_user_stories.md` (behavior) and `_techspec.md`
(components).

## Strategy

- **Frameworks and harnesses**: Vitest everywhere (`backend`, `shared`, `frontend`).
  Backend unit tests use `FakeUnitOfWork`/`InMemoryNoteRepository`/`InMemoryScanEventRepository`
  (`backend/test/support/InMemoryRepositories.ts`); fakes sit only at the repository
  boundary. Backend integration tests boot a real HTTP app against the dedicated test
  Postgres via `startTestApp()`/`jsonRequest()` (`backend/test/support/TestApp.ts`),
  using the project's fixed `OPERADOR`/`GERENTE` accounts. Frontend component tests use
  Testing Library with `render(withSession(routed(<Component />)))`
  (`frontend/src/test/session.tsx`), mocking only `../../api/client` functions under
  test via `vi.mock` while keeping the rest of the module real, with fixtures from
  `frontend/src/test/fixtures.ts` (`buildNote`, extended with `openedAt`/`confirmedTotal`/`expectedTotal`
  overrides as needed for the quick-scan cases). E2E uses Playwright against the E2E
  Postgres (`docker-compose.e2e.yaml`, per `CLAUDE.md`).
- **Execution**: `npm test` in `backend/`, `shared/`, and `frontend/` for unit +
  integration; `npm run test:e2e` (root) for E2E, after `npm run e2e:db:up`.
- **Conventions**: one `describe` per component/usecase, one `it` per case, case IDs
  embedded in the test name (`"UT-NNN ..."` / `"IT-NNN: ..."`), matching the style
  already used in `FinalizeNote.test.ts`, `notes-lifecycle.test.ts`, and
  `NoteSearchForm.test.tsx`.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001.AC-1 | Excluir abre diálogo de confirmação | UT-032 | — | E2E-001 |
| US-001.AC-2 | Confirmar exclui nota+itens+bipagens permanentemente | UT-001, UT-033 | IT-001, IT-002 | E2E-001 |
| US-001.AC-3 | Cancelar não exclui nada | UT-029 | — | E2E-002 |
| US-001.AC-4 | Qualquer operador pode excluir qualquer nota aberta | — | IT-001, IT-003 | — |
| US-001.EC-1 | Sessão expira durante a confirmação | — | IT-004 | — |
| US-001.EC-2 | Requisição não autenticada à API | — | IT-004 | — |
| US-001.EC-3 | Duas exclusões concorrentes da mesma nota | — | IT-009 | — |
| US-001.EC-4 | Nota já fechada não é excluível (defesa no backend) | UT-003, UT-004 | IT-007, IT-008 | — |
| US-001.EC-5 | Excluir a última nota aberta esvazia a fila | UT-043 | — | — |
| US-002.AC-1 | Sem progresso, aviso não menciona perda | UT-025 | — | — |
| US-002.AC-2 | Com progresso, aviso declara a contagem exata | UT-026 | — | E2E-002 |
| US-002.AC-3 | Aviso sempre declara que é permanente | UT-025, UT-026 | — | — |
| US-002.EC-1 | Nota 100% bipada mas ainda aberta também mostra o aviso | UT-027 | — | — |
| US-003.AC-1 | Botão de excluir desabilitado offline | UT-036 | — | E2E-003 |
| US-003.AC-2 | Nenhuma exclusão é enfileirada offline | UT-036 | — | E2E-003 |
| US-003.AC-3 | Botão volta ao normal ao reconectar | UT-037 | — | — |
| US-003.EC-1 | Conexão cai entre o toque e a confirmação | UT-035 | — | — |
| US-004.AC-1 | "Ver produtos" abre a nota certa | UT-031 | — | E2E-005 |
| US-004.AC-2 | "Excluir" não abre a bipagem | UT-032 | — | — |
| US-004.AC-3 | Os dois controles são independentes | UT-031, UT-032 | — | — |
| US-004.EC-1 | Card com nota de 1 item esperado | UT-038 | — | — |
| US-004.EC-2 | Toque em um botão nunca aciona o outro | UT-031, UT-032 | — | — |
| US-005.AC-1 | Botão de bipar abre a tela de bipagem | UT-039 | — | E2E-004 |
| US-005.AC-2 | Escolhe a nota de maior percentual concluído | UT-039 | — | E2E-004 |
| US-005.AC-3 | Empate resolve pela nota mais antiga | UT-040 | — | — |
| US-005.AC-4 | Bipagem é creditada corretamente independente da nota exibida | — (cobertura existente inalterada: `ScanScreen.test.tsx`, `resolveScan.test.ts`) | IT-012 | E2E-004 |
| US-005.AC-5 | Sem nota aberta, botão fica desabilitado | UT-041 | — | — |
| US-005.EC-1 | Única nota já 100% mas aberta, atalho ainda funciona | UT-044 | — | — |
| US-005.EC-2 | Offline com retrato local — comportamento inalterado (`ScanRoute`/`noteSnapshotStore` existentes, sem mudança) | — | — | — |
| US-005.EC-3 | Notas 0/0 não causam divisão por zero | UT-013 | — | — |
| US-006.AC-1 | Botão de alternar aparece no campo de senha do login | UT-019 | — | E2E-006 |
| US-006.AC-2 | Alternar mostra a senha em texto plano | UT-015 | — | E2E-006 |
| US-006.AC-3 | Alternar de novo volta a ocultar | UT-015 | — | E2E-006 |
| US-006.AC-4 | Alternar não tira o foco do campo | UT-016 | — | — |
| US-006.AC-5 | Botão tem rótulo acessível com o estado | UT-017 | — | — |
| US-006.EC-1 | Campo vazio | UT-018 | — | — |
| US-006.EC-2 | Envio funciona com senha visível; visibilidade reseta ao reabrir | UT-020, UT-021 | — | E2E-006 |
| US-007.AC-1 | Os dois campos da troca de senha têm alternância própria | UT-022 | — | E2E-007 |
| US-007.AC-2 | Alternar um campo não afeta o outro | UT-022 | — | E2E-007 |
| US-007.AC-3 | Validação de "as senhas não coincidem" continua funcionando | UT-023 | — | E2E-007 |
| US-007.EC-1 | Estados de visibilidade divergentes entre os dois campos | UT-022 | — | — |
| US-007.EC-2 | Erro de validação não reseta a visibilidade | UT-023 | — | — |
| `DeleteNote` usecase | Orquestra exclusão de 3 tabelas numa transação | UT-001, UT-002, UT-003, UT-004, UT-005 | IT-001, IT-002 | — |
| `NoteRepository.delete` / `ScanEventRepository.deleteByNoteId` | Exclusão real no Postgres, ordem de FK | — | IT-001, IT-002 | — |
| `NoteController` `DELETE :id` | Roteamento, papel, mapeamento de erro | — | IT-001–IT-009 | — |
| `completionOrder.ts` (`isCloserToCompletion`, `parseOpenedAt`) | Comparador extraído | UT-006–UT-009 | — | — |
| `pickQuickScanNote` | Escolha da nota mais próxima da conclusão | UT-010–UT-013 | — | — |
| `resolveScan` (regressão pós-refatoração) | Comportamento inalterado | cobertura existente `resolveScan.test.ts`, sem alteração | IT-012 | — |
| `shared` exports (`index.ts`) | `pickQuickScanNote`/`resolveScan` resolvem na raiz do pacote | — | IT-012 | — |
| `PasswordField` | Componente reutilizável de senha | UT-014–UT-018 | — | — |
| `DeleteNoteDialog` | Diálogo de confirmação | UT-025–UT-030 | — | — |
| `NoteQueueCard` | Card com ações explícitas | UT-031–UT-038 | — | — |
| `NotesQueueScreen` | Fila + atalho de bipagem rápida | UT-039–UT-044 | — | — |
| `PillButton` (`"danger"` variant) | Nova variante visual | UT-024 | — | — |
| `deleteNote` / `del<T>` (client) | Chamada HTTP de exclusão | UT-045, UT-046 | IT-001–IT-009 (via HTTP real) | — |
| `DELETE /notes/:id` | Endpoint | — | IT-001–IT-009 | E2E-001, E2E-002 |

## Unit Tests

### `DeleteNote` usecase (TechSpec: Core Interfaces, Impact Analysis)

- **UT-001** (happy): `DeleteNote.execute({ noteId })` — given an open note with 2 items
  and 3 scan events, deletes the note row, all its item rows, and all its scan event
  rows from the unit of work; returns `{ noteId }`.
- **UT-002** (error): `DeleteNote.execute({ noteId })` — given a `noteId` with no
  matching record, throws `NotFoundError("Nota não encontrada")`.
- **UT-003** (state): `DeleteNote.execute({ noteId })` — given a note with
  `status: "completed"`, throws `ConflictError("Nota não está mais em conferência")`
  and leaves the note, its items, and its scan events untouched.
- **UT-004** (state): `DeleteNote.execute({ noteId })` — given a note with
  `status: "closed_incomplete"`, throws the same `ConflictError` as UT-003.
- **UT-005** (happy): `DeleteNote.execute({ noteId })` — given an open note with zero
  scan events, succeeds and removes the note and its items.

### `completionOrder.ts` (TechSpec: Core Interfaces, ADR-006)

- **UT-006** (happy): `isCloserToCompletion(a, b)` — `a` with a strictly higher
  `confirmedQty/totalExpected` ratio than `b` returns `true`.
- **UT-007** (boundary): `isCloserToCompletion(a, b)` — `a` and `b` with an exactly
  equal ratio (via cross-multiplication) and `a.openedAtMs < b.openedAtMs` returns
  `true`; with `a.openedAtMs > b.openedAtMs` returns `false`.
- **UT-008** (boundary): `isCloserToCompletion(a, b)` — both `totalExpected: 0` (and
  `confirmedQty: 0`) does not throw or divide by zero; resolves purely by the
  `openedAtMs` tie-break.
- **UT-009** (boundary): `parseOpenedAt("not-a-date")` returns `Number.POSITIVE_INFINITY`.

### `pickQuickScanNote` (TechSpec: Core Interfaces, ADR-006)

- **UT-010** (happy): `pickQuickScanNote([noteA(3/10), noteB(8/10), noteC(1/5)])`
  returns `noteB`'s `noteId` (highest ratio).
- **UT-011** (boundary): `pickQuickScanNote([noteA(5/10, openedAt: T1), noteB(5/10, openedAt: T0)])`
  with `T0 < T1` returns `noteB`'s `noteId` (tie resolved by earliest `openedAt`).
- **UT-012** (empty): `pickQuickScanNote([])` returns `null`.
- **UT-013** (boundary): `pickQuickScanNote([noteA(0/0), noteB(1/5)])` does not throw
  and returns `noteB`'s `noteId` (0/0 never outranks a nonzero ratio, per the
  cross-multiplication tie-break).

### `PasswordField` (TechSpec: Core Interfaces, Impact Analysis)

- **UT-014** (happy): renders with the underlying `<input type="password">` by default.
- **UT-015** (happy): clicking the toggle button changes the input to `type="text"`;
  clicking again changes it back to `type="password"`.
- **UT-016** (happy): clicking the toggle button does not move focus away from the
  password `<input>`.
- **UT-017** (happy): the toggle `<button>` has `aria-label="Mostrar senha"` while
  hidden and `aria-label="Ocultar senha"` while visible.
- **UT-018** (empty): renders and toggles correctly with `value=""`.

### `LoginScreen` (TechSpec: Impact Analysis)

- **UT-019** (happy): the password field renders via `PasswordField`, starting hidden.
- **UT-020** (happy): typing a password, toggling it visible, and submitting the form
  still calls `signIn` with the typed value (visibility state doesn't affect submission).
- **UT-021** (happy): unmounting and remounting `LoginScreen` renders the password field
  hidden again (no visibility state persisted).

### `ChangePasswordScreen` (TechSpec: Impact Analysis)

- **UT-022** (happy): toggling "Nova senha" to visible does not change "Confirme a nova
  senha"'s visibility, and vice versa.
- **UT-023** (state): triggering `PASSWORDS_DO_NOT_MATCH` (mismatched values) does not
  alter either field's current visibility state.

### `PillButton` (TechSpec: Impact Analysis, Key Decisions)

- **UT-024** (happy): `variant="danger"` renders with the `bg-choc-700 text-cream-1`
  classes (matching `Banner`'s `error` tone).

### `DeleteNoteDialog` (TechSpec: Impact Analysis)

- **UT-025** (happy): `confirmedTotal={0}` renders a permanence warning without any
  "caixas conferidas" progress-loss text.
- **UT-026** (happy): `confirmedTotal={7} expectedTotal={20}` renders text stating
  7 of 20 boxes already confirmed will be lost.
- **UT-027** (boundary): `confirmedTotal={20} expectedTotal={20}` (fully scanned, still
  open) renders the same progress-loss warning as UT-026, not a special "already done"
  message.
- **UT-028** (happy): clicking the confirm button calls `onConfirm` and not `onCancel`.
- **UT-029** (happy): clicking the cancel button calls `onCancel` and not `onConfirm`.
- **UT-030** (state): `isSubmitting={true}` disables both the confirm and cancel
  buttons.

### `NoteQueueCard` (TechSpec: Impact Analysis)

- **UT-031** (happy): clicking "Ver produtos" calls `onOpen(note.noteId)` and does not
  open the delete dialog.
- **UT-032** (happy): clicking "Excluir" opens `DeleteNoteDialog` and does not call
  `onOpen`.
- **UT-033** (happy): confirming the open dialog calls `onDelete(note.noteId)`.
- **UT-034** (error): `onDelete` rejects with `ApiError(409, "Nota não está mais em conferência")`
  — the dialog shows that message and stays open (exclusion not assumed to have
  happened).
- **UT-035** (error): `onDelete` rejects with `NetworkError` — the dialog shows a
  connectivity message, mirroring `NoteSearchForm`'s offline messaging style.
- **UT-036** (state): `isOnline={false}` renders the "Excluir" button `disabled`.
- **UT-037** (state): `isOnline` flipping from `false` to `true` re-enables the
  "Excluir" button.
- **UT-038** (boundary): renders and both buttons work correctly for a note with
  exactly 1 expected item.

### `NotesQueueScreen` (TechSpec: Impact Analysis)

- **UT-039** (happy): with 3 open notes of differing completion ratios, clicking the
  quick-scan button calls `onOpenNote` with the `noteId` of the highest-ratio note
  (delegates to `pickQuickScanNote`).
- **UT-040** (boundary): with 2 open notes tied in ratio but different `openedAt`,
  clicking the quick-scan button calls `onOpenNote` with the earliest-opened note's id.
- **UT-041** (empty): with zero open notes, the quick-scan button renders `disabled`.
- **UT-042** (happy): confirming a delete inside a card (mocked `deleteNote` resolves)
  triggers `listNotes` to be called again and the deleted note's card to no longer
  render.
- **UT-043** (boundary): deleting the only open note leaves the "Nenhuma nota em
  conferência no momento." empty-state message visible.
- **UT-044** (boundary): a single open note at `confirmedTotal === expectedTotal` (100%
  but still `open`) is still a valid quick-scan target — clicking the button still
  calls `onOpenNote` with that note's id.

### `deleteNote` / `del<T>` (TechSpec: Core Interfaces, API Endpoints)

- **UT-045** (happy): `deleteNote(noteId)` issues a `fetch` with `method: "DELETE"` to
  `/notes/${noteId}` and resolves `undefined` on a `204` response.
- **UT-046** (error): `deleteNote(noteId)` rejects with `ApiError(status, message)` when
  the response is not `2xx` (mirrors the existing `post`/`patch` error handling).

## Integration Tests

### `DELETE /notes/:id` (TechSpec: API Endpoints)

- **IT-001**: operador logged in deletes an open note with no items confirmed and no
  scan events — response `204`; a subsequent `GET /notes/:id` for the same id returns
  `404`.
- **IT-002**: operador deletes an open note that has confirmed items and recorded scan
  events — response `204`; `GET /notes?status=open` no longer lists it, and
  `GET /notes/:id` returns `404` (confirms items and scan events were removed, not just
  the note row, via the absence of any FK violation and the note's total disappearance).
- **IT-003**: gerente (authenticated, wrong role) attempts `DELETE /notes/:id` on an
  open note — response `403`; the note is unaffected (`GET /notes/:id` still `200`).
- **IT-004**: request with no session cookie attempts `DELETE /notes/:id` — response
  `401`.
- **IT-005**: operador attempts `DELETE /notes/:id` for a syntactically valid UUID with
  no matching row — response `404`, message `"Nota não encontrada"`.
- **IT-006**: operador attempts `DELETE /notes/:id` with a non-UUID path segment —
  response `404` (via the existing `ParseUUIDPipe`/`NotFoundError` pattern, same as
  `GET /notes/:id`).
- **IT-007**: operador attempts `DELETE /notes/:id` on a note already `completed` —
  response `409`.
- **IT-008**: operador attempts `DELETE /notes/:id` on a note already `closed_incomplete`
  — response `409`.
- **IT-009**: operador deletes an open note, then immediately issues a second
  `DELETE /notes/:id` for the same id — first response `204`, second response `404`.

### Offline queue against a deleted note (TechSpec: Integration Points)

- **IT-010**: a note is deleted; a `POST /scan-events/sync` batch containing one event
  with `manualItemId` pointing at an item that belonged to the deleted note is sent —
  that event resolves as a server-side rejection (`404`-equivalent via
  `NotFoundError("Item não encontrado nas notas em conferência")`), the batch response
  reflects the per-event failure, and no scan event row is created for it.
- **IT-011**: a note is deleted; `POST /notes/:id/finalize` is then called with that
  same (now-deleted) id — response `404`, `"Nota não encontrada"`.

### `shared` package exports (TechSpec: Impact Analysis)

- **IT-012**: importing from the package root (`import { resolveScan, pickQuickScanNote } from "shared"`)
  resolves both as callable functions, and `resolveScan`'s existing behavior
  (`resolveScan.test.ts`) is unaffected by the `completionOrder.ts` extraction.

## End-to-End Tests

### Excluir nota da fila (US-001, US-002, US-003)

- **E2E-001**: operador loga → abre `/notas` com uma nota sem bipagens na fila → clica
  em "Excluir" no card → confirma no diálogo → a nota some da fila imediatamente.
- **E2E-002**: operador loga → abre `/notas` com uma nota que já tem caixas bipadas →
  clica em "Excluir" → vê o aviso com a contagem de caixas no diálogo → clica em
  "Cancelar" → a nota continua na fila com o mesmo progresso.
- **E2E-003**: operador loga, fica offline (contexto de rede do Playwright) → abre
  `/notas` → o botão "Excluir" de cada card aparece desabilitado.

### Ver produtos e bipagem rápida (US-004, US-005)

- **E2E-004**: operador loga com duas notas abertas, uma mais avançada que a outra →
  clica no botão "Bipar" da tela de fila (fora dos cards) → cai na tela de bipagem já
  aberta na nota mais próxima da conclusão.
- **E2E-005**: operador loga com duas notas abertas → clica em "Ver produtos" no card
  da nota menos avançada → cai na bipagem exatamente daquela nota, não da mais próxima
  da conclusão.

### Ver senha (US-006, US-007)

- **E2E-006**: usuário abre o login → digita e-mail e senha → clica no ícone de olho do
  campo de senha → vê a senha em texto plano → clica de novo → volta a ficar oculta →
  envia o formulário e entra normalmente.
- **E2E-007**: usuário no primeiro acesso é levado à troca de senha obrigatória → digita
  a nova senha e a confirmação → alterna a visibilidade de cada campo
  independentemente, conferindo que os dois valores batem → salva com sucesso.
