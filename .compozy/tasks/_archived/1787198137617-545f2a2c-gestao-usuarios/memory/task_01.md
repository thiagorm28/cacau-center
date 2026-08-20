# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Fundação de auth + schema entregue: colunas novas em `users`, enum `admin`, `Cpf`,
`SessionRevocationStore`, `PasswordChangeGuard`, bypass do admin no `RoleGuard`,
`Login` recusando conta desativada e o script de bootstrap do admin.
Todos os 23 IDs atribuídos (UT-001..016, UT-039/040, IT-001..004, IT-028) implementados.

## Important Decisions

- **IT-004 lido como "cookie pós-logout devolve 401", não como revogação de sessão no
  logout.** O `SessionRevocationStore` do contrato é por *usuário*, e `iat` tem
  granularidade de segundo: revogar no logout recusaria um login feito no mesmo segundo,
  quebrando IT-020/IT-025. TechSpec diz explicitamente que `/auth/logout` é inalterado.
- **`@AllowPendingPasswordChange()` já aplicado em `/auth/logout` e `/auth/me`** — o
  guard é global desde esta task; sem isso o estado intermediário deixaria um usuário
  com troca pendente sem conseguir nem deslogar.
- **`Cpf` exportado como `export default`** (convenção do repo) em vez do `export class`
  do snippet do TechSpec; a superfície (`Cpf.create` → `.digits`, `Error("CPF inválido")`)
  é idêntica.
- **`tsx` adicionado como devDependency do backend** para rodar `bootstrap:admin`: o type
  stripping nativo do Node recusa parameter properties, e nenhum runner de TS estava
  declarado no workspace.

## Learnings

- `drizzle-kit generate` **agrupa** `ALTER TYPE ... ADD VALUE` com os `ALTER TABLE` num
  arquivo só. A separação em `0002_user_role_admin` (enum) + `0003_users_admin_fields`
  (colunas) foi feita gerando em duas etapas — mexer no schema, gerar, restaurar, gerar
  de novo — para os snapshots de `drizzle/meta` ficarem consistentes.
- `cpf`/`birth_date` são `NOT NULL` sem default: a migração **falha** em qualquer banco
  que já tenha linhas em `users`. O `cacau_test` local precisou ser recriado
  (`DROP/CREATE DATABASE`); em produção isso exige backfill manual antes do deploy.
- `e2e/support/control-server.ts` semeia usuários por SQL cru e quebrou com as colunas
  novas — corrigido junto (não estava listado no task file).
- O `cwd` do Bash persiste entre chamadas; usar caminhos absolutos ao alternar entre a
  raiz e `backend/`.

## Files / Surfaces

Novos: `src/domain/valueobject/Cpf.ts`, `src/infra/auth/SessionRevocationStore.ts`,
`src/infra/guard/{PasswordChangeGuard,AllowPendingPasswordChange}.ts`,
`scripts/bootstrap-admin.ts`, `drizzle/000{2,3}_*.sql`, 4 arquivos de teste novos.
Alterados: schema/`users`, `SessionUser`, `UserRepository`, `TokenGenerator`,
`JwtStrategy`, `RoleGuard`, `AuthModule`, `app.module`, `Login`, `AuthController`,
`TestApp` (fixture `ADMIN`), `InMemoryRepositories`, `e2e/support/control-server.ts`,
`DEPLOY.md`, `.env.example`.

## Errors / Corrections

- Primeira versão da doc de deploy mandava rodar `node dist/scripts/bootstrap-admin.js`
  no container — errado: `scripts/` fica fora do `rootDir: src`, então não é compilado
  nem entra na imagem de runtime. Corrigido para a invocação a partir do checkout.

## Ready for Next Run

- `ADMIN` (`admin@loja.com` / `senha-admin`, `mustChangePassword: false`) já está semeado
  em `TestApp.reset()`. As fixtures `USER_PENDING_CHANGE`/`USER_DEACTIVATED` que
  `_tests.md` cita ainda **não** existem — task_02 precisa criá-las.
- `assertPasswordPolicy` (≥8 chars, ≥1 dígito) hoje vive em `scripts/bootstrap-admin.ts`;
  `ChangeInitialPassword` (task_02) deve extraí-la para um módulo compartilhado.
- `GET /auth/me` ainda **não** devolve `mustChangePassword` (o TechSpec pede) — task_02.
