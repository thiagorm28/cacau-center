# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts que são óbvios do repositório, task file, PRD ou git history.

## Objective Snapshot

`PasswordField` reutilizável (olho de mostrar/ocultar) no login e nos dois campos da
troca de senha. Concluída, com UT-014–UT-023 e E2E-006/E2E-007 passando.

## Important Decisions

- O `FIELD` (classe Tailwind duplicada nas duas telas) passou a morar em
  `PasswordField.tsx` e é reexportado de lá; o `LoginScreen` ainda o importa para o
  campo de e-mail.
- O componente renderiza `<label>` + campo dentro de um fragmento (sem wrapper), para
  não alterar o `gap-4` do `flex flex-col` das telas.
- Foco preservado com `preventDefault` no `mousedown` do botão (nada de refocar via
  ref: isso quebraria a navegação por teclado até o botão).
- `aria-pressed` adicionado além do `aria-label` — o techspec cita o par
  `aria-label`/`aria-pressed` nas Key Decisions.
- Nomes dos E2E com prefixo da feature (`melhorias-fila-e2e-00N-…`): `e2e-006-007-gerente.spec.ts`
  já ocupa os IDs 006/007 da suíte antiga, mesmo precedente do `gestao-usuarios-e2e-…`.

## Learnings

- `withSession` (`frontend/src/test/session.tsx`) não deixava sobrescrever `signIn`;
  ganhou o override opcional (retrocompatível) para o UT-020.

## Files / Surfaces

- Novos: `frontend/src/components/ui/PasswordField.tsx` (+ `.test.tsx`),
  `frontend/src/features/auth/LoginScreen.test.tsx`,
  `e2e/specs/melhorias-fila-e2e-006-ver-senha-login.spec.ts`,
  `e2e/specs/melhorias-fila-e2e-007-ver-senha-troca.spec.ts`.
- Modificados: `LoginScreen.tsx`, `ChangePasswordScreen.tsx` (+ test),
  `frontend/src/test/session.tsx`, `e2e/support/fixtures.ts`.

## Errors / Corrections

- O E2E pegou uma regressão que o unit test não pegava: o `loginAs` compartilhado usava
  `getByLabel("Senha")` (substring), que passou a casar também com o botão "Mostrar
  senha" → strict mode violation em toda a suíte. Corrigido com `{ exact: true }` no
  helper. `getByLabelText` do Testing Library é exato por padrão, por isso os unitários
  não acusaram nada.

## Ready for Next Run

- Nada pendente. Suíte E2E completa (19 testes) rodada e verde após a mudança no helper.
