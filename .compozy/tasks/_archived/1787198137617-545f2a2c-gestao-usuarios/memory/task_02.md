# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

CRUD de usuários (7 usecases), `UserController` admin-only, `POST /auth/change-password`
e as fixtures novas do `TestApp`. Concluída e verificada.

## Important Decisions

- `ChangeInitialPassword` mora no `AuthModule`, não no `UserModule`: quem a expõe é o
  `AuthController`, e o `UserModule` já importa `AuthModule` — o inverso criaria ciclo.
- `AuthController.changePassword` reemite o cookie a partir do `@CurrentUser()` com
  `mustChangePassword: false`, o que mantém a assinatura `Promise<void>` do usecase
  fixada na TechSpec sem precisar reler o usuário do banco.
- Senha inicial e política de senha viraram `domain/service/InitialPassword.ts` e
  `domain/service/PasswordPolicy.ts`; `scripts/bootstrap-admin.ts` passou a importar a
  política em vez de duplicá-la.
- `ListUsers` devolve `cpf`/`birthDate` além de nome/papel/status para o formulário de
  edição do task_04 não precisar de uma segunda chamada.
- `PATCH /users/:id` nunca devolve 409: a tabela de endpoints da TechSpec lista esse
  status para CPF/e-mail duplicado, mas os dois campos não são editáveis (PRD, task
  file, e a própria prosa da TechSpec) e `_tests.md` não atribui caso para ele.

## Learnings

- Pipes globais rodam antes dos de controller no Nest, então um `ValidationPipe`
  escopado por rota não consegue sobrescrever o status do global. Para atender ao 422
  exigido pela tabela de endpoints foi preciso mudar o pipe global em `bootstrap.ts`
  (`errorHttpStatusCode: 422`) — ver o registro em MEMORY.md.
- O 409 de cadastro concorrente (IT-011) só sai correto porque `CreateUser` traduz a
  violação `23505` do Postgres; a checagem prévia por e-mail/CPF não serializa nada.
  O erro do pg pode vir embrulhado pelo Drizzle, então a busca pelo `code` percorre a
  cadeia de `cause`.

## Files / Surfaces

- Novos: `application/usecase/{CreateUser,ListUsers,UpdateUser,DeactivateUser,ReactivateUser,ResetPassword,ChangeInitialPassword}.ts`,
  `domain/service/{InitialPassword,PasswordPolicy}.ts`, `infra/controller/UserController.ts`,
  `infra/controller/dto/UserDto.ts`, `infra/module/UserModule.ts`,
  `test/unit/{UserManagement,ChangeInitialPassword}.test.ts`,
  `test/integration/{users,change-password}.test.ts`.
- Alterados: `app.module.ts`, `bootstrap.ts`, `infra/controller/AuthController.ts`,
  `infra/module/AuthModule.ts`, `scripts/bootstrap-admin.ts`, `test/support/TestApp.ts`,
  `test/integration/notes-lifecycle.test.ts` (IT-028: 400 → 422).

## Errors / Corrections

- Nenhuma correção de rota: a suíte passou na primeira execução completa.

## Ready for Next Run

- Verificação final: `npm run typecheck`, `npm run test` (12 + 157 + 49 testes) e
  `npm run build` na raiz, todos verdes. Sem commit automático (`--auto-commit=false`).
