# TechSpec: Gestão de Usuários e Papel Admin

## Executive Summary

A feature adiciona um papel `admin` (conta única, provisionada por script de bootstrap
fora da aplicação — ADR-001) com acesso irrestrito a todo o sistema, uma tela nova de
CRUD de usuários (`operador`/`gerente`), troca de senha obrigatória no primeiro acesso
e após reset (ADR-002), desativação lógica preservando histórico (ADR-003) e um botão
de logout visível.

A implementação adiciona quatro colunas à tabela `users` existente (`cpf`,
`birth_date`, `active`, `must_change_password`) e um novo bounded context `users`
(usecases + `UserController`, mirrorando `NoteModule`/`ScanEventModule`), sem alterar
nenhuma rota existente de `NoteController`/`ScanEventController` — o acesso irrestrito
do admin é resolvido inteiramente dentro de `RoleGuard`/`RequireRole` (ADR-006), não
rota a rota. O corte imediato de acesso ao desativar um usuário usa um store de
revogação em memória no próprio processo, comparado contra o `iat` do JWT (ADR-005),
evitando tanto uma consulta ao banco em todo request autenticado quanto um componente
de infraestrutura novo (Redis) — trade-off aceito: o estado de revogação não sobrevive
a um restart do processo, risco assumido explicitamente dado o deploy single-instance
e a escala de uma única loja.

## System Architecture

### Component Overview

**Backend** — novo bounded context `users`, seguindo exatamente o padrão de
`notes`/`scanEvents` (domain/entity ausente, como já é o caso hoje para `User` — ver
Key Decisions):

- `application/usecase/{CreateUser,ListUsers,UpdateUser,DeactivateUser,ReactivateUser,
  ResetPassword,ChangeInitialPassword}.ts` — um usecase por operação, injetados via
  `UnitOfWork`.
- `infra/controller/UserController.ts` (`@Roles("admin")` em toda rota) +
  `AuthController.ts` ganha `POST /auth/change-password`.
- `infra/repository/UserRepository.ts` estendido (create/update/list/setActive/
  setPassword/findByCpf).
- `infra/module/UserModule.ts` — importa `AuthModule` (para `PasswordHasher` e o novo
  `SessionRevocationStore`, ambos exportados de lá) e registra em `AppModule.imports`.
- `domain/valueobject/Cpf.ts` — validação de formato + dígito verificador, usada só em
  `CreateUser` (CPF nunca é editável, por regra de negócio do PRD).
- `infra/auth/SessionRevocationStore.ts` — novo provider em `AuthModule`, exportado.
- `infra/guard/RoleGuard.ts` — bypass de `admin` (ADR-006); novo
  `infra/guard/PasswordChangeGuard.ts` + decorator `AllowPendingPasswordChange` —
  bloqueia toda rota exceto as marcadas quando `mustChangePassword` está pendente.
- `infra/auth/{TokenGenerator,JwtStrategy}.ts` — payload ganha `mustChangePassword`;
  `JwtStrategy.validate` passa a consultar `SessionRevocationStore`.
- Script standalone `backend/scripts/bootstrap-admin.ts` (novo `npm run
  bootstrap:admin -w backend`) — ADR-001, roda uma vez na implantação, fora do ciclo de
  request/resposta.

**Frontend** — novo diretório `features/users/` (tela de gestão) e
`features/auth/ChangePasswordScreen.tsx` (troca obrigatória), seguindo os mesmos
padrões já usados por `features/history`/`features/scan`: formulários com `useState`
puro (sem lib de formulário — nenhuma existe no projeto), `Card`/`Dialog`/`PillButton`/
`Banner` reaproveitados, `Screen` para o layout de cada tela.

### Story → Component Mapping

| Stories | Componente |
|---|---|
| US-001 | `RoleGuard`/`RequireRole` (bypass admin, ADR-006) |
| US-002 | Botão de logout novo, slotado em `Screen.header` de cada tela; `AuthController.logout` (já existe) |
| US-003, US-004 | `CreateUser`, `Cpf`, `UserController.POST /users`, `features/users/UserFormDialog` |
| US-005 | `ListUsers`, `UserController.GET /users`, `features/users/UsersScreen` |
| US-006 | `UpdateUser`, `UserController.PATCH /users/:id` |
| US-007 | `DeactivateUser`, `SessionRevocationStore.revoke`, `UserController.POST /users/:id/deactivate` |
| US-008 | `ReactivateUser`, `UserController.POST /users/:id/reactivate` |
| US-009 | `ResetPassword`, `UserController.POST /users/:id/reset-password` |
| US-010, US-011 | `ChangeInitialPassword`, `PasswordChangeGuard`, `AuthController.POST /auth/change-password`, `ChangePasswordScreen`, `AppRoot` redirect wrapper |
| US-012 | `RoleGuard`/`RequireRole` (rejeição por papel, sem mudança de comportamento) |
| US-013 | `DeactivateUser` (rejeita alvo com `role === "admin"`) |

### Data Flow

1. **Bootstrap** (deploy-time, uma vez): `bootstrap-admin.ts` lê `ADMIN_*` de env,
   valida CPF/senha, checa se já existe `role = "admin"` (idempotente), insere a linha
   com `active=true`, `mustChangePassword=true`.
2. **Login**: `Login` usecase (existente) passa a também rejeitar `!active` com
   `UnauthorizedError` (mesma mensagem genérica já usada para credenciais inválidas —
   não revela se a conta existe mas está desativada); em caso de sucesso, o payload do
   JWT ganha `mustChangePassword` lido da linha do usuário.
3. **Toda request autenticada**: `AuthGuard` valida assinatura/expiração →
   `JwtStrategy.validate` rejeita (retorna `false`, vira 401 pelo caminho já existente
   de `handleRequest`) se `SessionRevocationStore.isRevoked(sub, iat)` → `PasswordChangeGuard`
   rejeita (403) se `mustChangePassword` e a rota não tem
   `@AllowPendingPasswordChange()` → `RoleGuard` passa direto se `role === "admin"`,
   senão checa `@Roles(...)`.
4. **Cadastro** (`CreateUser`): valida `Cpf.create`, checa duplicidade de e-mail e CPF
   (ativos e inativos) dentro da mesma transação, hash de `CPF@DDMMAAAA`, insere com
   `active=true`, `mustChangePassword=true`.
5. **Primeiro acesso / pós-reset**: login aceito com a senha inicial → JWT com
   `mustChangePassword=true` → toda rota exceto `/auth/change-password`, `/auth/me`,
   `/auth/logout` retorna 403 → usuário chama `POST /auth/change-password` →
   `ChangeInitialPassword` valida política + diferença da senha inicial, atualiza
   `passwordHash`/`mustChangePassword=false` → `AuthController` reemite o cookie de
   sessão (mesma rotina de `login`, refatorada para um método privado compartilhado)
   com um JWT novo (`mustChangePassword=false`).
6. **Desativação**: `DeactivateUser` rejeita se o alvo tem `role === "admin"` (US-013 —
   como só existe um admin e a rota é admin-only, isso cobre tanto autodesativação
   quanto qualquer tentativa via API direta); senão marca `active=false` e chama
   `SessionRevocationStore.revoke(id)`.
7. **Reativação**: `ReactivateUser` marca `active=true`; não mexe em senha nem no
   store de revogação (uma reativação seguida de novo login naturalmente emite um
   token com `iat` posterior a qualquer revogação anterior).
8. **Reset de senha**: `ResetPassword` rejeita se `!active` (US-009.EC-1); recomputa
   `CPF@DDMMAAAA`, marca `mustChangePassword=true`. Não aciona o store de revogação —
   nenhum critério de aceite exige cortar uma sessão já aberta nesse caso (só o log
   seguinte precisa cair na tela de troca).

## Implementation Design

### Core Interfaces

```ts
// backend/src/domain/valueobject/Cpf.ts
export class Cpf {
  private constructor(readonly digits: string) {}

  static create(raw: string): Cpf {
    const digits = raw.replace(/\D/g, "");
    const allSameDigit = /^(\d)\1{10}$/.test(digits);
    if (digits.length !== 11 || allSameDigit || !hasValidCheckDigits(digits)) {
      throw new Error("CPF inválido");
    }
    return new Cpf(digits);
  }
}
```

```ts
// backend/src/infra/auth/SessionRevocationStore.ts
@Injectable()
export class SessionRevocationStore {
  private readonly revokedAtMs = new Map<string, number>();

  revoke(userId: string): void {
    this.revokedAtMs.set(userId, Date.now());
  }

  isRevoked(userId: string, tokenIssuedAtSeconds: number): boolean {
    const revokedAt = this.revokedAtMs.get(userId);
    return revokedAt !== undefined && tokenIssuedAtSeconds * 1000 < revokedAt;
  }
}
```

```ts
// backend/src/application/usecase/CreateUser.ts
export type Input = {
  name: string; email: string; cpf: string; birthDate: string; // "YYYY-MM-DD"
  role: "operador" | "gerente";
};
export type Output = { id: string; name: string; email: string; role: string; active: boolean };

@Injectable()
export class CreateUser {
  constructor(
    @Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
    @Inject("PasswordHasher") private readonly passwordHasher: PasswordHasher,
  ) {}
  async execute(input: Input): Promise<Output> { /* Cpf.create, checa duplicidade, hash CPF@DDMMAAAA */ }
}
```

Demais usecases seguem o mesmo formato (`@Injectable`, `Input`/`Output`, `execute()`
via `UnitOfWork`), resumidos por assinatura:

- `ListUsers.execute(): Promise<{ users: UserListItem[] }>` — sem filtro/paginação
  (volume esperado é de poucos funcionários por loja).
- `UpdateUser.execute({id, name, birthDate, role}): Promise<Output>` — `role` só aceita
  `"operador" | "gerente"` no tipo; rejeita com `ForbiddenError` se o alvo atual tiver
  `role === "admin"`.
- `DeactivateUser.execute({id}): Promise<{id, active: false}>` — `NotFoundError` se não
  existe; `ForbiddenError("A conta admin não pode ser desativada")` se `role ===
  "admin"`.
- `ReactivateUser.execute({id}): Promise<{id, active: true}>`.
- `ResetPassword.execute({id}): Promise<{id}>` — `ConflictError` se `!active`.
- `ChangeInitialPassword.execute({userId, newPassword, confirmPassword}):
  Promise<void>` — erro (422) se não coincidirem, se não atender à política (≥8
  caracteres, ≥1 dígito) ou se igual à senha inicial recomputada a partir do CPF/data
  de nascimento já armazenados.

```ts
// backend/src/infra/guard/RoleGuard.ts (trecho alterado)
canActivate(context: ExecutionContext): boolean {
  const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [...]);
  if (!roles) return true;
  const { user } = context.switchToHttp().getRequest();
  if (!user) throw new UnauthorizedError();
  if (user.role === "admin") return true; // ADR-006
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return true;
}
```

```ts
// backend/src/infra/guard/PasswordChangeGuard.ts (novo, global, registrado após AuthGuard)
canActivate(context: ExecutionContext): boolean {
  const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [...]);
  const { user } = context.switchToHttp().getRequest();
  if (allowed || !user?.mustChangePassword) return true;
  throw new ForbiddenError("Troca de senha obrigatória pendente");
}
```

### Data Models

```ts
// backend/src/infra/database/schema/users.ts (alterado)
export const userRole = pgEnum("user_role", ["operador", "gerente", "admin"]);
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  cpf: text("cpf").notNull().unique(),                 // só dígitos, 11 chars
  birthDate: date("birth_date").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`invoiceNotes.openedBy`/`scanEvents.scannedBy` permanecem inalterados (FK simples,
sem `onDelete`) — desativação não toca essas linhas, satisfazendo ADR-003 sem
migração adicional nelas.

**Migração**: `drizzle-kit generate` produz um `ALTER TYPE user_role ADD VALUE
'admin'` (precisa rodar fora de uma transação — verificar que a migração gerada não
agrupa esse `ALTER TYPE` com os `ALTER TABLE ADD COLUMN` na mesma transação; se
agrupar, separar em dois arquivos de migração) mais as quatro colunas novas (`cpf`
sem default, exige um valor de backfill ou uma migração em duas etapas se já houver
usuários em produção — hoje só existem os dois usuários de teste/seed, então um
backfill manual antes do deploy é aceitável).

`UserRepository` (interface estendida):

```ts
export type UserRecord = {
  userId: string; name: string; email: string; cpf: string; birthDate: string;
  passwordHash: string; role: "operador" | "gerente" | "admin";
  active: boolean; mustChangePassword: boolean;
};
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByIds(ids: string[]): Promise<UserRecord[]>;
  findByCpf(cpf: string): Promise<UserRecord | null>;
  list(): Promise<UserRecord[]>;
  create(data: Omit<UserRecord, "userId">): Promise<UserRecord>;
  update(id: string, data: Pick<UserRecord, "name" | "birthDate" | "role">): Promise<UserRecord>;
  setActive(id: string, active: boolean): Promise<void>;
  setPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
}
```

**JWT payload** (`TokenGenerator.ts`, alterado):

```ts
export type JwtPayload = {
  sub: string; name: string; email: string;
  role: "operador" | "gerente" | "admin"; mustChangePassword: boolean;
};
```

**Frontend** (`api/types.ts`, alterado): `UserRole = "operador" | "gerente" | "admin"`;
`SessionUser` ganha `mustChangePassword: boolean`; novos tipos `UserListItem`,
`CreateUserInput`, `UpdateUserInput` espelhando os DTOs acima.

### API Endpoints

| Method | Path | Papel | Descrição | Códigos |
|---|---|---|---|---|
| POST | `/auth/login` | público | Inalterado; resposta agora inclui `mustChangePassword` | 200, 401, 429 |
| POST | `/auth/logout` | qualquer autenticado (`@AllowPendingPasswordChange`) | Inalterado | 204 |
| GET | `/auth/me` | qualquer autenticado (`@AllowPendingPasswordChange`) | Resposta ganha `mustChangePassword` | 200 |
| POST | `/auth/change-password` | qualquer autenticado (`@AllowPendingPasswordChange`) | Troca a senha (US-010/US-011); reemite cookie | 200, 422 |
| GET | `/users` | admin | Lista todos os usuários | 200 |
| POST | `/users` | admin | Cadastra operador/gerente (US-003) | 201, 409, 422 |
| PATCH | `/users/:id` | admin | Edita nome/data de nascimento/perfil (US-006) | 200, 404, 409, 422 |
| POST | `/users/:id/deactivate` | admin | Desativa (US-007) | 200, 403, 404 |
| POST | `/users/:id/reactivate` | admin | Reativa (US-008) | 200, 404 |
| POST | `/users/:id/reset-password` | admin | Reseta para senha inicial (US-009) | 200, 404, 409 |

`409` = CPF/e-mail duplicado (`POST /users`, `PATCH /users/:id`) ou usuário desativado
(`POST /users/:id/reset-password`); `403` = alvo é a conta admin
(`POST /users/:id/deactivate`) ou troca de senha pendente bloqueando outra rota;
`422` = validação de campo (CPF inválido, senha fora da política, senhas não
coincidem).

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `schema/users.ts` + migração | Modified | 4 colunas novas + enum widened; `cpf` sem default exige backfill/decisão pré-deploy | Gerar e testar migração contra Postgres do e2e |
| `UserRepository` + `InMemoryUserRepository` | Modified | Métodos novos (create/update/list/setActive/setPassword) | Unit + integration tests |
| `SessionUser`/`Role` (backend), `UserRole` (frontend) | Modified | União de tipos ganha `"admin"` — baixo risco, verificado em compilação | Nenhuma ação além do build |
| `TokenGenerator`/`JwtStrategy` | Modified | Payload ganha `mustChangePassword`; validate consulta `SessionRevocationStore` | Unit tests cobrindo revogado/pendente/normal |
| `RoleGuard` | Modified | Bypass de admin — caminho crítico de segurança | Unit test explícito: admin acessa rota `@Roles("operador")`/`@Roles("gerente")` sem listcollection |
| `PasswordChangeGuard` (novo) + decorator | New | Bloqueia rotas quando pendente | Unit + integration tests (bloqueado vs. permitido) |
| `SessionRevocationStore` (novo) | New | Estado em memória, perdido em restart (risco aceito, ADR-005) | Unit tests |
| `NoteController`/`ScanEventController` | None | ADR-006 resolve acesso do admin sem tocar essas rotas | Integration test confirmando admin passa sem alteração de código |
| `UserModule` (controller + 6 usecases) | New | Superfície nova, admin-only | Unit + integration tests por `_tests.md` |
| `AuthController` | Modified | Nova rota `change-password`; `@AllowPendingPasswordChange` em `logout`/`me`; extração de método privado de emissão de cookie compartilhado com `login` | Integration tests |
| `bootstrap-admin.ts` + script `package.json` | New | Só roda no deploy, fora do ciclo de request | Teste manual local + documentação do processo de deploy |
| `api/types.ts`, `api/client.ts` | Modified | Tipos e funções novas espelhando os endpoints acima | Nenhum teste dedicado (sem lógica) |
| `SessionContext` | Modified | Expõe `mustChangePassword`; ganha wrapper de redirecionamento global | Component test (US-011) |
| `RequireRole` | Modified | Bypass de admin (mesma lógica de `RoleGuard`) | Component test |
| `App.tsx` (rotas) | Modified | Rotas `/usuarios`, `/trocar-senha`; wrapper de redirecionamento por `mustChangePassword` | Component/E2E test |
| `features/users/*` (novo) | New | Tela de listagem + formulário de cadastro/edição + confirmações de desativar/reativar/resetar | Component tests |
| `features/auth/ChangePasswordScreen.tsx` (novo) | New | Tela de troca obrigatória | Component test |
| `Screen` / botão de logout | Modified | Novo slot reaproveitando `header` existente de `Screen`, sem mudar a API do componente | Component test + verificação visual manual contra `DESIGN.md` |

## Testing Approach

- **Frameworks**: Vitest em todas as camadas (unit, integration backend, component
  frontend), Playwright para E2E — todos já configurados no repositório.
- **Unidade (backend)**: cada usecase testado contra `FakeUnitOfWork` +
  `InMemoryUserRepository` (estendida com os novos métodos), fakes só na borda de I/O
  (repositório, `PasswordHasher`, `SessionRevocationStore` pode ser a implementação
  real em memória — já é rápida e determinística o bastante para unit test). Guards
  testados isoladamente construindo um `ExecutionContext` falso, seguindo o padrão já
  usado em `Auth.test.ts`.
- **Unidade (frontend)**: `@testing-library/react` para `UsersScreen`,
  `ChangePasswordScreen`, formulário de cadastro/edição e o wrapper de redirecionamento
  por `mustChangePassword`, seguindo o padrão de `HistoryScreen.test.tsx`.
- **Integração (backend)**: `TestApp` (boot real da aplicação + Postgres do e2e)
  estendido com fixtures `ADMIN`/usuário-com-troca-pendente/usuário-desativado
  análogas às já existentes `OPERADOR`/`GERENTE`; cobre as rotas novas de `/users` e
  `/auth/change-password`, além de confirmar que `NoteController`/`ScanEventController`
  aceitam o admin sem alteração de rota.
- **E2E (Playwright)**: fluxos ponta a ponta do PRD — cadastro → primeiro acesso com
  troca obrigatória → navegação normal; desativação → login recusado; autodesativação
  bloqueada; logout visível em qualquer tela.
- **Dependências de ambiente**: nenhuma nova além do Postgres do e2e já configurado
  (`docker-compose.e2e.yaml`) — a migração de schema precisa rodar nesse banco antes da
  suíte.

## Development Sequencing

### Build Order

1. Migração de schema (`cpf`, `birth_date`, `active`, `must_change_password`, enum
   `admin`) — base para tudo o resto.
2. `Cpf` value object, `UserRepository` estendido (+ `InMemoryUserRepository`),
   widening de `Role`/`UserRole` em ambos os lados.
3. `SessionRevocationStore`, alteração de `TokenGenerator`/`JwtStrategy`, `RoleGuard`
   (ADR-006), `PasswordChangeGuard` — infraestrutura de auth antes de qualquer usecase
   que dependa dela.
4. Usecases (`CreateUser`, `ListUsers`, `UpdateUser`, `DeactivateUser`,
   `ReactivateUser`, `ResetPassword`, `ChangeInitialPassword`).
5. `UserController`, `UserModule`, alterações em `AuthController` (`change-password`,
   `@AllowPendingPasswordChange`, extração do método de emissão de cookie).
6. `bootstrap-admin.ts` + script `package.json`.
7. Frontend: tipos/`api/client.ts` → `SessionContext` (`mustChangePassword`) →
   `RequireRole`/rotas em `App.tsx` → `ChangePasswordScreen` → `features/users/*` →
   botão de logout no `header` de cada `Screen`.
8. Testes por camada conforme `_tests.md`, E2E por último (depende de todo o resto
   estar de pé).

### Technical Dependencies

- A migração de schema precisa rodar (e o CPF de usuários pré-existentes precisar de
  backfill, se houver) antes de qualquer deploy desta feature — hoje só há dois
  usuários de teste/seed, então não há dado de produção real bloqueando isso.
- O script de bootstrap do admin precisa rodar uma vez, após a migração, antes do
  primeiro acesso esperado do dono da loja — nenhuma dependência externa nova.

## Monitoring and Observability

Fora de escopo qualquer métrica/alerta novo — o sistema não tem infraestrutura de
observabilidade além de logs de erro já existentes (`ErrorFilter`), e o volume (uma
loja) não justifica introduzir uma agora. Ação concreta: usecases que mutam estado
sensível (`DeactivateUser`, `ReactivateUser`, `ResetPassword`, `CreateUser`) logam em
nível `info` o `userId` do admin ator e do usuário alvo — nunca CPF nem senha/hash, por
exigência explícita do PRD ("sem exposição desnecessária em logs").

## Technical Considerations

### Key Decisions

- **Corte de acesso via store em memória, não consulta ao banco nem Redis** —
  confirmado com o usuário durante o grilling técnico após confrontar a alternativa
  de aceitar uma janela de 8h com a regra de negócio já escrita no PRD. Trade-off:
  zero I/O extra por request, mas estado não sobrevive a restart (ver ADR-005).
- **`admin` sempre passa em `RoleGuard`/`RequireRole`**, em vez de listado
  explicitamente em cada rota — evita que rotas futuras esqueçam de incluir `admin`
  (ADR-006).
- **`mustChangePassword` viaja no JWT, não no store de revogação** — é reavaliado a
  cada emissão de token (login ou troca de senha bem-sucedida), sem precisar de
  estado compartilhado entre requests; o cenário de reset durante uma sessão já aberta
  não está coberto por nenhum critério de aceite, então não foi resolvido para não
  adicionar complexidade sem requisito.
- **Política de senha da troca obrigatória: mínimo 8 caracteres + ao menos 1 dígito** —
  decidido com o usuário; equilíbrio entre segurança mínima e fricção baixa para
  funcionários digitando no celular em loja física.
- **CPF validado por checksum implementado localmente** (dígito verificador completo +
  rejeição de sequências de dígito repetido), sem nova dependência — não existe
  biblioteca de CPF já instalada no monorepo, e o algoritmo é pequeno o suficiente
  para não justificar uma.
- **`User` continua sem entidade de domínio rica** (`domain/entity/User.ts`) — mantém
  consistência com o tratamento atual de `Login`, que já opera sobre `UserRecord` puro
  vindo do repositório. Introduzir uma entidade rica para `User` seria uma mudança de
  padrão maior que o pedido desta feature; `Cpf` como value object isolado cobre a
  única regra de validação que precisa de uma abstração própria.
- **Admin bootstrap também nasce com `mustChangePassword=true`** — reaproveita o
  mesmo mecanismo já construído para todo mundo, em vez de um caso especial; mais
  seguro por padrão para uma senha vinda de variável de ambiente.

### Known Risks

- **Restart do backend perde o estado do `SessionRevocationStore`** — ver ADR-005;
  risco aceito explicitamente, sem mitigação automática proposta.
- **Migração de enum (`ALTER TYPE ... ADD VALUE`) fora de transação** — se o
  `drizzle-kit generate` agrupar esse `ALTER TYPE` com os `ALTER TABLE` na mesma
  migração/transação, o Postgres recusa; mitigação: separar em dois arquivos de
  migração se necessário, verificado ao rodar `db:generate` localmente antes do
  merge.
- **Backfill de `cpf`/`birth_date` para usuários pré-existentes** — hoje só há
  usuários de teste/seed, sem dado real em produção; se isso mudar antes do deploy, a
  migração precisa de uma etapa manual de backfill antes de tornar as colunas
  `NOT NULL`.

## Architecture Decision Records

- [ADR-001: Papel admin único, provisionado fora da aplicação](adrs/adr-001.md)
- [ADR-002: Senha inicial previsível com troca obrigatória no primeiro login](adrs/adr-002.md)
- [ADR-003: Desativação em vez de exclusão de usuários](adrs/adr-003.md)
- [ADR-004: Login continua por e-mail; CPF é dado de cadastro, não identificador de autenticação](adrs/adr-004.md)
- [ADR-005: Corte de acesso imediato via store de revogação em memória](adrs/adr-005.md)
- [ADR-006: Bypass automático do admin nos guards de papel](adrs/adr-006.md)
