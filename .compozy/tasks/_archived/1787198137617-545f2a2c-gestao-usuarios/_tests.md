# Test Specification: Gestão de Usuários e Papel Admin

Canonical test contract para a feature de administração de usuários e papel admin.
Companion de `_techspec.md`. Derivado de `_user_stories.md` (comportamento) e
`_techspec.md` (componentes).

## Strategy

- **Frameworks e harnesses**: Vitest em todas as camadas (unit backend, integration
  backend, unit/component frontend), Playwright para E2E — todos já configurados no
  repositório, sem ferramenta nova.
- **Fakes na borda de I/O**: usecases testados contra `FakeUnitOfWork` +
  `InMemoryUserRepository` (estendida com os métodos novos de `_techspec.md`, seção
  Data Models); `SessionRevocationStore` real (implementação em memória já é
  determinística o bastante para unit test, não precisa de fake). Guards testados
  isolados com um `ExecutionContext` falso, seguindo `Auth.test.ts`.
- **Execução**: unit/integration backend via `npm run test -w backend` (Vitest, SWC,
  `fileParallelism: false` para integração); component frontend via `npm run test -w
  frontend`; E2E via `npm run test:e2e` na raiz (`docker-compose.e2e.yaml` sobe o
  Postgres dedicado antes).
- **Convenções**: nomes de teste referenciam o ID (`UT-NNN`/`IT-NNN`/`E2E-NNN`) no
  título do `it(...)`, como já é feito hoje (`Auth.test.ts`, `FinalizeNote.test.ts`).
  `TestApp` ganha fixtures `ADMIN`, `USER_PENDING_CHANGE`, `USER_DEACTIVATED` análogas
  às já existentes `OPERADOR`/`GERENTE`.

## Coverage Matrix

### Por história de usuário

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | Admin loga e navega por qualquer tela | — | IT-002, IT-003 | E2E-007 |
| US-001.EC-1 | Sessão de admin expira | mecanismo já existente, inalterado — sem caso novo | — | — |
| US-001.EC-2 | Múltiplas sessões simultâneas do admin | mecanismo já existente, inalterado — sem caso novo | — | — |
| US-002 | Logout visível para qualquer papel | — | IT-004 | E2E-004 |
| US-002.EC-1 | Logout sem rede | `SessionContext.signOut` já existente, inalterado — sem caso novo | — | — |
| US-002.EC-2 | Clique duplo em logout | comportamento client-side já existente — sem caso novo | — | — |
| US-003 | Cadastrar operador/gerente | UT-017 | IT-005 | E2E-001 |
| US-003.EC-1 | Campo obrigatório vazio | UT-045 | IT-007 | — |
| US-003.EC-2 | Nenhum perfil selecionado | UT-046 | — | — |
| US-004 | Validação de CPF/e-mail inválido | UT-021 | IT-010 | — |
| US-004.EC-1 | CPF com dígitos repetidos | UT-004 | — | — |
| US-004.EC-2 | Cadastros simultâneos com mesmo CPF/e-mail | — | IT-011 | — |
| US-005 | Listar usuários com nome/perfil/status | UT-022 | IT-013 | E2E-007 |
| US-005.EC-1 | Nenhum usuário além do admin | UT-023 | — | — |
| US-005.EC-2 | Grande número de usuários | sem paginação nesta versão (Key Decisions) — sem caso dedicado | — | — |
| US-006 | Editar nome/data/perfil | UT-024 | IT-014 | — |
| US-006.EC-1 | Tentativa de editar perfil para admin | UT-026, UT-047 | IT-015 | — |
| US-006.EC-2 | Editar CPF/e-mail duplicado | N/A — CPF/e-mail não são editáveis nesta feature (PRD Core Features restringe edição a nome/data de nascimento/perfil); a EC no catálogo de user stories diverge do PRD nesse ponto, TechSpec segue o PRD | — | — |
| US-006.EC-3 | Sessão aberta mantém papel antigo até novo login | comportamento já aceito e inalterado — sem caso novo | — | — |
| US-007 | Desativar usuário que saiu da loja | UT-027 | IT-016 | E2E-002 |
| US-007.EC-1 | Sessão já aberta perde acesso ao desativar | — | IT-018 | — |
| US-007.EC-2 | Tentativa de desativar o próprio admin | UT-029 | IT-019 | E2E-006 |
| US-008 | Reativar usuário desativado | UT-030 | IT-020 | — |
| US-008.EC-1 | Reativação com CPF/e-mail reaproveitado | coberto por IT-009 — duplicidade já impede a reutilização antes da reativação ser relevante | — | — |
| US-009 | Resetar senha para o padrão inicial | UT-032 | IT-021 | E2E-003 |
| US-009.EC-1 | Reset em usuário desativado | UT-033 | IT-022 | — |
| US-009.EC-2 | Dois resets em sequência | UT-034 | IT-023 | — |
| US-010 | Trocar senha obrigatoriamente no primeiro login | UT-035 | IT-024 | E2E-001 |
| US-010.EC-1 | Nova senha igual à senha inicial | UT-037 | IT-026 | — |
| US-010.EC-2 | Confirmações de senha não coincidem | UT-036, UT-049 | — | — |
| US-011 | Bloqueado de qualquer rota até trocar a senha | UT-042, UT-043 | IT-024 | E2E-001 |
| US-011.EC-1 | Fecha e volta com troca ainda pendente | — | IT-025 | — |
| US-012 | Não acessar gestão de usuários (operador/gerente) | UT-041 | IT-012 | E2E-005 |
| US-012.EC-1 | Token adulterado reivindicando admin | recusado pela verificação de assinatura JWT já existente — sem caso novo | — | — |
| US-013 | Admin não consegue desativar a própria conta | UT-029, UT-048 | IT-019 | E2E-006 |
| US-013.EC-1 | Tentativa via chamada direta à API | — | IT-019 | — |

### Por componente

| Component | Responsibility | Unit | Integration | E2E |
|---|---|---|---|---|
| `Cpf` (value object) | Validação de formato e dígito verificador | UT-001–UT-005 | IT-010 | — |
| `SessionRevocationStore` | Revogação em memória por timestamp | UT-006–UT-008 | IT-018 | — |
| `RoleGuard` | Autorização por papel + bypass admin | UT-009–UT-011 | IT-002, IT-003, IT-012 | — |
| `PasswordChangeGuard` | Bloqueio de rota com troca pendente | UT-012–UT-014 | IT-024 | — |
| `JwtStrategy`/`TokenGenerator` | Payload + checagem de revogação | UT-015–UT-016 | IT-004, IT-018 | — |
| `Login` (modificado) | Rejeita usuário desativado | UT-039–UT-040 | IT-016 | — |
| `CreateUser` | Cadastro com validação e senha inicial | UT-017–UT-021 | IT-005–IT-011 | E2E-001 |
| `ListUsers` | Listagem completa | UT-022–UT-023 | IT-013 | — |
| `UpdateUser` | Edição de nome/data/perfil | UT-024–UT-026 | IT-014, IT-015 | — |
| `DeactivateUser` | Desativação lógica + revogação | UT-027–UT-029 | IT-016, IT-018, IT-019 | E2E-002, E2E-006 |
| `ReactivateUser` | Reativação sem alterar senha | UT-030–UT-031 | IT-020 | — |
| `ResetPassword` | Reset para senha inicial | UT-032–UT-034 | IT-021–IT-023 | E2E-003 |
| `ChangeInitialPassword` | Troca obrigatória de senha | UT-035–UT-038 | IT-024, IT-026 | E2E-001 |
| `RequireRole` (frontend) | Bypass admin no roteamento | UT-041 | — | E2E-005, E2E-007 |
| Wrapper de troca pendente (frontend) | Redireciona enquanto `mustChangePassword` | UT-042–UT-043 | — | E2E-001 |
| `UsersScreen`/`UserFormDialog` (frontend) | Listagem e formulário admin | UT-044–UT-048 | — | E2E-001, E2E-002, E2E-006 |
| `ChangePasswordScreen` (frontend) | Tela de troca obrigatória | UT-049 | — | E2E-001 |
| `bootstrap-admin.ts` | Provisionamento idempotente do admin | — | IT-028 | — |

## Unit Tests

### `Cpf` (TechSpec: Core Interfaces)

- **UT-001** (happy): `Cpf.create("111.444.777-35")` — dígito verificador válido, retorna instância com `digits === "11144477735"`.
- **UT-002** (happy): `Cpf.create("11144477735")` (sem pontuação) — produz o mesmo `digits` que UT-001.
- **UT-003** (error): `Cpf.create("11144477736")` (último dígito verificador alterado) — lança `Error("CPF inválido")`.
- **UT-004** (error): `Cpf.create("11111111111")` — todos os dígitos iguais — lança `Error("CPF inválido")` (US-004.EC-1).
- **UT-005** (boundary): `Cpf.create("123")` — comprimento inválido — lança `Error("CPF inválido")`.

### `SessionRevocationStore` (TechSpec: Core Interfaces)

- **UT-006** (happy): `isRevoked("u1", anyIat)` sem chamada prévia a `revoke` — retorna `false`.
- **UT-007** (state): `revoke("u1")` seguido de `isRevoked("u1", iatBefore)` onde `iatBefore` é anterior ao momento de `revoke` — retorna `true`.
- **UT-008** (state): `revoke("u1")` seguido de `isRevoked("u1", iatAfter)` onde `iatAfter` é posterior — retorna `false`.

### `RoleGuard` (TechSpec: Core Interfaces, ADR-006)

- **UT-009** (happy): contexto com `user.role === "admin"` e rota `@Roles("operador")` — `canActivate` retorna `true` sem checar a lista.
- **UT-010** (error): contexto com `user.role === "operador"` e rota `@Roles("gerente")` — lança `ForbiddenError` (regressão do comportamento existente).
- **UT-011** (error): contexto sem `user` — lança `UnauthorizedError` (regressão).

### `PasswordChangeGuard` (TechSpec: Core Interfaces)

- **UT-012** (happy): `user.mustChangePassword === false` — `canActivate` retorna `true` para qualquer rota.
- **UT-013** (happy): `user.mustChangePassword === true` e rota com `@AllowPendingPasswordChange()` — retorna `true`.
- **UT-014** (error): `user.mustChangePassword === true` e rota sem o decorator — lança `ForbiddenError`.

### `JwtStrategy.validate` (TechSpec: Data Flow passo 3)

- **UT-015** (happy): payload válido, `SessionRevocationStore.isRevoked` retorna `false` — resolve para `SessionUser` incluindo `mustChangePassword` do payload.
- **UT-016** (error): `SessionRevocationStore.isRevoked` retorna `true` para o `sub`/`iat` do payload — `validate` retorna `false`.

### `CreateUser` (TechSpec: Core Interfaces)

- **UT-017** (happy): input válido (CPF `11144477735`, nascimento `1990-03-15`) — cria usuário com `active: true`, `mustChangePassword: true`, `passwordHash` igual ao hash de `11144477735@15031990`.
- **UT-018** (error): `input.role` forçado para `"admin"` via chamada direta (bypass do tipo) — lança `Error` (defesa contra uso indevido da rota, ADR-001).
- **UT-019** (error): e-mail já pertence a um usuário ativo — lança `ConflictError` com mensagem específica de e-mail duplicado (US-004.AC-2).
- **UT-020** (error): CPF já pertence a um usuário desativado — lança `ConflictError` com mensagem específica de CPF duplicado (US-004.AC-2, cobre "ativo ou desativado").
- **UT-021** (error): CPF com dígito verificador inválido — propaga o erro de `Cpf.create` (US-004.AC-1).

### `ListUsers` (TechSpec: Core Interfaces)

- **UT-022** (happy): repositório com admin + operador + gerente — retorna os três com `name`/`role`/`active`.
- **UT-023** (boundary): repositório só com o admin — retorna array de um item, sem erro (US-005.EC-1).

### `UpdateUser` (TechSpec: Core Interfaces)

- **UT-024** (happy): usuário existente — altera `name`/`birthDate`/`role` e retorna o registro atualizado.
- **UT-025** (error): `id` inexistente — lança `NotFoundError`.
- **UT-026** (error): alvo atual tem `role === "admin"` — lança `ForbiddenError` (defesa, espelha `DeactivateUser`).

### `DeactivateUser` (TechSpec: Core Interfaces, ADR-005)

- **UT-027** (happy): usuário ativo — marca `active: false` e chama `SessionRevocationStore.revoke(id)` exatamente uma vez.
- **UT-028** (error): `id` inexistente — lança `NotFoundError`.
- **UT-029** (error): alvo tem `role === "admin"` — lança `ForbiddenError` (US-013.AC-1/EC-1).

### `ReactivateUser` (TechSpec: Core Interfaces)

- **UT-030** (happy): usuário desativado — marca `active: true`, `passwordHash` permanece inalterado (US-008.AC-2).
- **UT-031** (error): `id` inexistente — lança `NotFoundError`.

### `ResetPassword` (TechSpec: Core Interfaces)

- **UT-032** (happy): usuário ativo — `passwordHash` passa a corresponder a `CPF@DDMMAAAA`, `mustChangePassword: true`.
- **UT-033** (error): usuário com `active: false` — lança `ConflictError` (US-009.EC-1).
- **UT-034** (idempotency): duas chamadas consecutivas no mesmo usuário — estado final idêntico a uma única chamada (US-009.EC-2).

### `ChangeInitialPassword` (TechSpec: Core Interfaces, ADR-002)

- **UT-035** (happy): nova senha válida e confirmada — atualiza `passwordHash`, `mustChangePassword: false`.
- **UT-036** (error): `newPassword !== confirmPassword` — lança `Error` (US-010.EC-2).
- **UT-037** (error): `newPassword` igual à senha inicial recomputada do CPF/nascimento atuais — lança `Error` (US-010.EC-1).
- **UT-038** (boundary): política de senha — `"abc1234"` (7 chars) rejeitado; `"abcdefgh"` (8 chars, sem dígito) rejeitado; `"abcdefg1"` (8 chars + 1 dígito) aceito.

### `Login` (TechSpec: Data Flow passo 2, modificado)

- **UT-039** (error): usuário com `active: false` e senha correta — lança `UnauthorizedError` com a mesma mensagem genérica de credenciais inválidas (sem revelar desativação).
- **UT-040** (happy): usuário com `mustChangePassword: true` — valor propagado para o payload/`Output` do usecase.

### `RequireRole` (frontend, TechSpec: ADR-006)

- **UT-041** (happy): `user.role === "admin"`, `role="operador"` exigido pelo componente — renderiza os filhos sem redirecionar.

### Wrapper de troca de senha pendente (frontend, TechSpec: Data Flow passo 5)

- **UT-042** (happy): `session.user.mustChangePassword === true` e rota atual diferente de `/trocar-senha` — redireciona para `/trocar-senha` (US-011.AC-1).
- **UT-043** (happy): `session.user.mustChangePassword === false` — não redireciona, renderiza a rota normalmente (US-011.AC-2).

### `UsersScreen` / `UserFormDialog` (frontend, TechSpec: Component Overview)

- **UT-044** (happy): lista com usuário ativo e desativado — renderiza indicadores visuais distintos para cada status (US-005.AC-2).
- **UT-045** (error): submissão do formulário de cadastro com campo obrigatório vazio — bloqueia o envio e mostra o campo faltante (US-003.EC-1).
- **UT-046** (error): submissão sem nenhum perfil selecionado — bloqueia o envio (US-003.EC-2).
- **UT-047** (happy): seletor de perfil no formulário — só renderiza as opções "operador" e "gerente" (US-003.AC-3, US-006.EC-1).
- **UT-048** (happy): linha do próprio admin na listagem — ação de desativar ausente/desabilitada (US-013.AC-1).

### `ChangePasswordScreen` (frontend, TechSpec: Data Flow passo 5)

- **UT-049** (error): campos de nova senha e confirmação com valores diferentes — bloqueia o envio (US-010.EC-2).

## Integration Tests

### Acesso irrestrito do admin (US-001, ADR-006)

- **IT-001**: `POST /auth/login` com credenciais do admin (fixture `ADMIN`) — 200, corpo inclui `mustChangePassword`.
- **IT-002**: sessão de admin, `GET` numa rota `@Roles("operador")` existente (bipagem) — 200, sem nenhuma alteração de código na rota.
- **IT-003**: sessão de admin, `GET` numa rota `@Roles("gerente")` existente (histórico) — 200.

### Logout (US-002)

- **IT-004**: `POST /auth/logout` seguido de `GET` numa rota protegida reusando o cookie antigo — 401.

### Cadastro (US-003, US-004)

- **IT-005**: admin, `POST /users` com dados válidos — 201, usuário criado com `active: true`, `mustChangePassword: true`.
- **IT-006**: admin, `POST /users` com `role: "admin"` no corpo — 422 (rejeitado pelo DTO).
- **IT-007**: admin, `POST /users` sem `cpf` — 422 (US-003.EC-1).
- **IT-008**: admin, `POST /users` com e-mail já cadastrado (usuário ativo) — 409 (US-004.AC-2).
- **IT-009**: admin, `POST /users` com CPF já pertencente a um usuário desativado — 409 (US-004.AC-2, também cobre US-008.EC-1).
- **IT-010**: admin, `POST /users` com CPF de dígito verificador inválido — 422 (US-004.AC-1).
- **IT-011** (concurrency): duas requisições `POST /users` simultâneas com o mesmo CPF — exatamente uma retorna 201, a outra 409 (US-004.EC-2).

### Listagem e edição (US-005, US-006)

- **IT-012**: sessão de operador ou gerente, `GET /users` — 403 (US-012.AC-1).
- **IT-013**: admin, `GET /users` com admin + operador + gerente cadastrados — 200, todos presentes com `name`/`role`/`active`.
- **IT-014**: admin, `PATCH /users/:id` alterando nome/data/perfil de um operador — 200, mudança refletida em `GET /users` subsequente.
- **IT-015**: admin, `PATCH /users/:id` com `role: "admin"` — 422.

### Desativação e reativação (US-007, US-008, US-013)

- **IT-016**: admin, `POST /users/:id/deactivate` num operador ativo — 200; login subsequente desse operador — 401.
- **IT-017**: usuário desativado tinha uma nota aberta antes da desativação — `GET` do relatório/histórico dessa nota ainda mostra o nome dele (US-007.AC-3).
- **IT-018** (state): usuário com sessão já aberta (cookie válido) é desativado por outra chamada — próxima request com o cookie antigo retorna 401 (US-007.EC-1, exercício ponta a ponta do `SessionRevocationStore`).
- **IT-019**: admin, `POST /users/:adminId/deactivate` no próprio `id` — 403 (US-013.AC-1/EC-1).
- **IT-020**: admin, `POST /users/:id/reactivate` num usuário desativado — 200; login com a senha anterior à desativação funciona (US-008.AC-1/AC-2).

### Reset de senha (US-009)

- **IT-021**: admin, `POST /users/:id/reset-password` num usuário ativo — 200; login com a senha antiga é recusado; login com `CPF@DDMMAAAA` funciona e retorna `mustChangePassword: true`.
- **IT-022**: admin, `POST /users/:id/reset-password` num usuário desativado — 409 (US-009.EC-1).
- **IT-023** (idempotency): duas chamadas consecutivas de reset no mesmo usuário — estado final consistente, sem erro na segunda chamada (US-009.EC-2).

### Troca obrigatória de senha (US-010, US-011)

- **IT-024**: login com a senha inicial → `GET` numa rota qualquer retorna 403 → `POST /auth/change-password` com senha nova válida → 200 → mesma rota retorna 200 (fluxo completo US-010/US-011).
- **IT-025** (state): usuário com troca pendente faz logout e loga de novo sem completar a troca — ainda é bloqueado nas demais rotas (US-011.EC-1, confirma persistência no servidor).
- **IT-026**: `POST /auth/change-password` com `newPassword` igual à senha inicial — 422 (US-010.EC-1).

### Controle de acesso (US-012)

- **IT-027**: sessão de operador ou gerente, `POST /users` direto (sem passar pela UI) — 403, corpo da resposta não contém dados de outros usuários.

### Provisionamento do admin (ADR-001)

- **IT-028** (idempotency): executar `bootstrap-admin.ts` duas vezes em sequência contra o mesmo banco — a segunda execução detecta o admin existente e não cria uma segunda linha nem lança erro.

## End-to-End Tests

### Cadastro e primeiro acesso (US-003, US-010, US-011)

- **E2E-001**: admin loga → abre gestão de usuários → cadastra um operador → desloga → operador loga com `CPF@dataDeNascimento` → é levado à tela de troca de senha → define nova senha → acessa a tela de bipagem normalmente.

### Funcionário sai da loja (US-007, US-013)

- **E2E-002**: admin loga → abre gestão de usuários → desativa um operador com histórico de notas → operador tenta logar → acesso recusado → admin consulta o histórico/relatório → nome do operador ainda aparece nas notas que ele abriu.

### Funcionário esquece a senha (US-009, US-010)

- **E2E-003**: admin loga → abre gestão de usuários → reseta a senha de um gerente → gerente loga com `CPF@dataDeNascimento` → é levado à tela de troca de senha obrigatória.

### Logout (US-002)

- **E2E-004**: usuário autenticado (qualquer papel) clica no botão de logout visível na tela → volta à tela de login → tentativa de navegar de volta a uma rota protegida é recusada.

### Controle de acesso à gestão de usuários (US-012)

- **E2E-005**: operador ou gerente navega diretamente para a URL da gestão de usuários → acesso negado; nenhum link para essa tela aparece na navegação.

### Autodesativação bloqueada (US-013)

- **E2E-006**: admin abre a própria linha na listagem de usuários → ação de desativar indisponível ou recusada com mensagem explicativa.

### Acesso irrestrito do admin (US-001, US-005)

- **E2E-007**: admin loga → navega por bipagem, histórico/relatórios e gestão de usuários na mesma sessão, sem nenhum bloqueio de papel.
