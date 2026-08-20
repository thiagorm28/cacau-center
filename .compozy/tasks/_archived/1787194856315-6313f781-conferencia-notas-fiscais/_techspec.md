# TechSpec: Conferência de Notas Fiscais

## Executive Summary

O sistema é implementado como um monorepo com três pacotes npm workspace na raiz:
`shared` (motor de alocação e tipos de domínio, TypeScript puro), `backend` (serviço
NestJS seguindo Clean Architecture/DDD, primeiro bounded context do repositório,
persistência via Drizzle ORM) e `frontend` (PWA React instalável,
mobile-first, com leitura de código de barras via biblioteca open-source baseada em
WASM e operação offline via IndexedDB). O `shared` existe especificamente para que o
algoritmo de alocação de bipagens entre notas concorrentes rode de forma idêntica no
cliente (feedback offline imediato) e no servidor (fonte de verdade), eliminando o risco
de duas implementações divergentes da regra de negócio mais sensível do produto.

A integração com a API interna da Cacau Show
(`GET http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML`) é isolada num
gateway HTTP dedicado que retorna XML puro, parseado para o modelo de domínio da nota. O
progresso de conferência é modelado como um log de eventos de bipagem append-only
(`scan_events`) com um contador denormalizado por item (`note_items.confirmed_qty`)
mantido na mesma transação — o log garante rastreabilidade e idempotência na
sincronização offline, o contador garante leitura rápida para o feedback ao vivo.
Autenticação usa sessão JWT curta (8h) em cookie `httpOnly`, com papéis `operador` e
`gerente`. O deploy assume um único VPS com Docker Compose e um reverse proxy (Caddy)
para TLS automático, e o design de sincronização offline assume deliberadamente um
único dispositivo ativo por vez (confirmado pelo usuário), sem mecanismo de resolução de
conflito entre dispositivos.

## System Architecture

### Component Overview

- **`shared`** — pacote TypeScript puro, sem dependência de framework. Contém o motor
  de alocação (`resolveScan`), os tipos de domínio consumidos por ele (`PendingNote`,
  `ScanResolution`) e as funções puras de cálculo de relatório de divergência. Consumido
  por `backend` e `frontend`.
- **`backend`** — serviço NestJS (Clean Architecture: `domain` / `application/usecase` /
  `infra`), primeiro bounded context do repositório. Dono da fonte de verdade: notas,
  itens, eventos de bipagem, usuários, histórico. Expõe a API REST consumida pelo
  `frontend`. Único componente que fala com a API externa da Cacau Show.
- **`frontend`** — PWA React (Vite + `vite-plugin-pwa`), instalável, mobile-first,
  seguindo `DESIGN.md`. Contém a UI de busca de nota, bipagem por câmera, fila
  multi-nota, relatórios e histórico gerencial. Mantém uma fila local (IndexedDB) de
  eventos de bipagem feitos offline até sincronizar.
- **API interna Cacau Show** (externa) — fonte da XML da NFe por número de faturamento;
  consumida exclusivamente pelo `backend` via `NfeGateway`.
- **Postgres** — armazenamento único do `backend`.

### Data Flow

1. Operador digita número de faturamento no `frontend` → `POST /notes` no `backend` →
   `backend` chama `NfeGateway` → API Cacau Show retorna XML → `backend` parseia,
   persiste `invoice_notes`/`note_items`, devolve resumo ao `frontend`.
2. Operador bipa uma caixa → `frontend` roda `resolveScan` (pacote `shared`) localmente
   contra o estado de notas abertas em cache → dá feedback imediato → se online, envia
   `POST /scan-events` para o `backend` confirmar/persistir (que roda o mesmo
   `resolveScan` como fonte de verdade); se offline, enfileira o evento em IndexedDB.
3. Ao reconectar, `frontend` drena a fila local via `POST /scan-events/sync` → `backend`
   aplica cada evento em ordem, de forma idempotente por `client_event_id`.
4. Ao finalizar uma nota (automático ao 100% ou manual), `backend` gera o relatório de
   divergência e persiste o fechamento; `frontend` exibe o relatório.
5. Gerente/dono consulta `GET /notes/history` e `GET /notes/:id/report` para
   acompanhamento posterior.

## Implementation Design

### Core Interfaces

**`shared/src/allocation/types.ts`** — contrato do motor de alocação (ADR-001, ADR-006):

```ts
export type ScanResolution =
  | { kind: "matched"; noteId: string; itemId: string }
  | { kind: "exceeded"; noteId: string; itemId: string }
  | { kind: "unidentified" };

export interface PendingNoteItem {
  itemId: string;
  cProd: string;
  cEan: string | null;
  expectedQty: number;
  confirmedQty: number;
}

export interface PendingNote {
  noteId: string;
  openedAt: string; // ISO 8601, usado no desempate FIFO
  items: readonly PendingNoteItem[];
}

export function resolveScan(
  openNotes: readonly PendingNote[],
  scannedCode: string,
): ScanResolution;
```

`resolveScan` é uma função pura: (1) procura itens com `cProd`/`cEan === scannedCode` e
`confirmedQty < expectedQty` entre todas as `openNotes`; sem candidatos, credita à nota
cuja aplicação da bipagem resulta no maior percentual de conclusão total, com empate
resolvido por `openedAt` mais antigo; (2) se não houver candidato pendente mas existir
algum item com esse código já 100% confirmado em alguma nota aberta, retorna
`"exceeded"` (mesmo critério de desempate); (3) caso contrário, `"unidentified"`.

**`backend/src/infra/gateway/NfeGateway.ts`** (ADR-011, integração externa):

```ts
export interface NfeGateway {
  fetchByInvoiceNumber(invoiceNumber: string): Promise<NfeXmlData>;
}

export interface NfeXmlData {
  chaveAcesso: string;
  numeroNota: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  items: ReadonlyArray<{
    cProd: string;
    cEan: string | null;
    descricao: string;
    unidade: string;
    quantidade: number;
  }>;
  rawXml: string;
}
```

`NfeGatewayHttp implements NfeGateway` chama a rota `GerarXML` via `axios`, parseia a
resposta com `fast-xml-parser`, e lança `NfeNotFoundError` quando a resposta não contém
uma estrutura `nfeProc` reconhecível, ou `NfeServiceUnavailableError` em timeout/erro de
rede/5xx.

**`backend/src/application/usecase/SearchNote.ts`**:

```ts
export type Input = { invoiceNumber: string; operatorId: string };
export type Output = {
  noteId: string;
  status: "open" | "completed" | "closed_incomplete";
  items: ReadonlyArray<{ itemId: string; description: string; expectedQty: number; confirmedQty: number }>;
};
```

`SearchNote.execute`: rejeita se já existir nota `open` com o mesmo `invoiceNumber`
(`Error("Nota já está em conferência")` → 422); chama `NfeGateway`; persiste
`invoice_notes` + `note_items` numa `db.transaction`; devolve o resumo.

**`backend/src/application/usecase/ApplyScanEvent.ts`** (ADR-007):

```ts
export type Input = {
  clientEventId: string;
  scannedCode: string;
  scannedAt: string;
  operatorId: string;
  manualItemId?: string;
  markUnidentified?: boolean;
};
export type Output = { resolution: ScanResolution };
```

`ApplyScanEvent.execute`: se `client_event_id` já existe em `scan_events`, retorna o
resultado gravado (idempotência), sem reaplicar. Caso contrário: se `manualItemId`
informado, resolve diretamente para esse item (checando ainda estar pendente, senão
`"exceeded"`); se `markUnidentified`, resolve `"unidentified"`; senão, carrega as notas
`open` do operador com `db.query` (incluindo `items`), monta `PendingNote[]` e chama
`resolveScan` do `shared`. Em qualquer caso de `"matched"`/`"exceeded"`/`"manual
matched"`, insere o `scan_event` e atualiza `note_items.confirmed_qty` (quando
`matched`/`manual_matched`) dentro da mesma `db.transaction`; se o item atingir
`expectedQty`, verifica se a nota ficou 100% completa e, se sim, marca a nota como
`completed`. `"unidentified"` insere o evento com `note_id = null`.

**`backend/src/application/usecase/FinalizeNote.ts`**:

```ts
export type Input = { noteId: string; operatorId: string; confirmIncomplete: boolean };
export type Output = { status: "completed" | "closed_incomplete"; report: DivergenceReport };
```

Se a nota já está `completed`, apenas retorna o relatório. Se está `open` com itens
pendentes e `confirmIncomplete !== true`, lança `Error("Itens pendentes: confirme para
finalizar mesmo assim")` (422, tratado pelo frontend como o diálogo de confirmação). Se
confirmado, marca `closed_incomplete`, e — dentro da mesma transação — reivindica todos
os `scan_events` com `result = "unidentified"` e `note_id IS NULL` ainda não
reivindicados por nenhuma nota, associando-os a esta nota (regra explícita: caixas não
identificadas aparecem no relatório da primeira nota finalizada depois delas).

**`backend/src/application/usecase/SyncScanEvents.ts`** (ADR-010):

```ts
export type Input = {
  operatorId: string;
  events: ReadonlyArray<{
    clientEventId: string; scannedCode: string; scannedAt: string;
    manualItemId?: string; markUnidentified?: boolean;
  }>;
};
export type Output = { applied: number; duplicates: number };
```

Aplica cada evento do array, em ordem, chamando a mesma lógica de `ApplyScanEvent`
dentro de uma única `db.transaction` por evento; eventos com `client_event_id` já
existente contam como `duplicates` e não são reaplicados.

### Data Models

Schema Postgres (Drizzle, `backend/src/infra/database/schema/`):

```ts
export const userRole = pgEnum("user_role", ["operador", "gerente"]);
export const noteStatus = pgEnum("note_status", ["open", "completed", "closed_incomplete"]);
export const scanResult = pgEnum("scan_result", ["matched", "manual_matched", "exceeded", "unidentified"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
export const invoiceNotes = pgTable("invoice_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: text("invoice_number").notNull(),
  nfeChaveAcesso: text("nfe_chave_acesso").notNull(),
  nfeNumero: text("nfe_numero").notNull(),
  supplierCnpj: text("supplier_cnpj").notNull(),
  supplierName: text("supplier_name").notNull(),
  status: noteStatus("status").notNull().default("open"),
  rawXml: text("raw_xml").notNull(),
  openedBy: uuid("opened_by").notNull().references(() => users.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => [
  index("invoice_notes_status_idx").on(table.status),
  index("invoice_notes_invoice_number_idx").on(table.invoiceNumber),
]);
```

```ts
export const noteItems = pgTable("note_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => invoiceNotes.id),
  cProd: text("c_prod").notNull(),
  cEan: text("c_ean"),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  expectedQty: numeric("expected_qty", { precision: 12, scale: 3 }).notNull(),
  confirmedQty: numeric("confirmed_qty", { precision: 12, scale: 3 }).notNull().default("0"),
}, (table) => [
  uniqueIndex("note_items_note_id_c_prod_idx").on(table.noteId, table.cProd),
  index("note_items_note_id_idx").on(table.noteId),
]);
```

```ts
export const scanEvents = pgTable("scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientEventId: uuid("client_event_id").notNull().unique(),
  scannedCode: text("scanned_code").notNull(),
  result: scanResult("result").notNull(),
  noteId: uuid("note_id").references(() => invoiceNotes.id),
  noteItemId: uuid("note_item_id").references(() => noteItems.id),
  scannedBy: uuid("scanned_by").notNull().references(() => users.id),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("scan_events_note_id_idx").on(table.noteId),
  index("scan_events_result_idx").on(table.result),
]);
```

`invoice_notes.invoiceNumber` não tem constraint `unique` no banco — a checagem de
duplicidade (US-001.EC-2) é uma regra de aplicação (`WHERE invoice_number = $1 AND
status = 'open'`), já que o mesmo número pode legitimamente reaparecer depois que a nota
original foi fechada. `$inferSelect`/`$inferInsert` de cada tabela são os tipos usados
nos repositórios; nenhum DTO é escrito à mão.

**Tipos de request/response da API** (`backend/src/infra/controller/dto/`): DTOs
`class-validator` na borda HTTP, mapeados para os `Input`/`Output` dos use cases —
nunca reutilizados como tipos de domínio.

### API Endpoints

| Method | Path | Papel | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | `{email, password}` → seta cookie de sessão (8h), `200 {id, name, role}` \| `401` |
| POST | `/auth/logout` | autenticado | Limpa o cookie, `204` |
| GET | `/auth/me` | autenticado | `200 {id, name, role}` \| `401` |
| POST | `/notes` | operador | `{invoiceNumber}` → busca na API Cacau Show e cria a nota. `201` \| `404` (não encontrada) \| `409` (já em conferência) \| `502` (API indisponível) |
| GET | `/notes?status=open` | operador | Fila de notas em conferência com progresso resumido. `200 [...]` |
| GET | `/notes/:id` | autenticado | Detalhe da nota com itens e progresso. `200` \| `404` |
| POST | `/notes/:id/finalize` | operador | `{confirmIncomplete?: boolean}` → `200 {status, report}` \| `409` (itens pendentes sem `confirmIncomplete`) |
| GET | `/notes/:id/report` | autenticado | Relatório de divergência/confirmação da nota. `200` \| `409` (ainda `open`) |
| POST | `/scan-events` | operador | Bipagem única, online. `{clientEventId, scannedCode, scannedAt, manualItemId?, markUnidentified?}` → `200 {resolution}` |
| POST | `/scan-events/sync` | operador | Lote de bipagens offline. `{events: [...]}` → `200 {applied, duplicates}` |
| GET | `/notes/history` | gerente | Lista de notas finalizadas, com filtro por `status`/período. `200 [...]` |

Todas as rotas exigem cookie de sessão válido (`AuthGuard`); rotas marcadas `operador`
ou `gerente` aplicam também `RoleGuard`. Erros de domínio (`Error` lançado pelos use
cases) são mapeados para `422` pelo filtro global; `401`/`403` vêm dos guards;
`404`/`409`/`502` são retornados explicitamente pelos controllers com base no tipo de
erro (`NfeNotFoundError` → `404`, `NfeServiceUnavailableError` → `502`, conflito de
estado → `409`).

## Integration Points

- **API interna Cacau Show — consulta de XML de NFe.**
  `GET http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML?empresa=<EMPRESA_CODE>&documento=<numeroFaturamento>`,
  sem autenticação aparente, resposta XML puro (`nfeProc`). `EMPRESA_CODE` é uma
  variável de ambiente do `backend` fixa por loja (ex.: `1102`). Tratamento de erro: erro
  de rede/timeout/5xx → `NfeServiceUnavailableError` (US-003 AC-2); resposta sem
  estrutura `nfeProc` reconhecível → `NfeNotFoundError` (US-003 AC-1). Sem retry
  automático — cada tentativa é uma ação explícita do operador (botão "tentar
  novamente"). **Risco de conectividade**: o endpoint parece ser um servidor de
  relatórios da rede interna da Cacau Show; é preciso validar que o VPS de produção
  consegue alcançá-lo pela internet pública antes de finalizar o deploy (ver ADR-011 e
  Known Risks).

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| Root `package.json` (workspaces) | new | Ainda não existe; define os workspaces `shared`, `backend`, `frontend` | Criar |
| `playwright.config.ts` | new | Referenciado pelo `CLAUDE.md` mas ainda não existe no repo | Criar, com `webServer` para `backend` (3001) e `frontend` (5174) |
| `shared/` | new | Motor de alocação, tipos de domínio compartilhados | Criar |
| `backend/` | new | Primeiro bounded context do repositório | Criar (scaffold completo) |
| `frontend/` | new | PWA React | Criar |
| Schema Postgres do `backend` | new | Todo o armazenamento da feature | Criar via migrations Drizzle |
| `docker-compose.yaml` (dev) | new | Orquestração local (Postgres, backend, frontend) | Criar |
| `docker-compose.prod.yaml` + Caddy | new | Deploy em VPS com TLS (ADR-011) | Criar |

Como o repositório está vazio de código de aplicação, todo o impacto é criação —
nenhum componente existente é modificado.

## Testing Approach

- **Frameworks**: Vitest para testes de unidade e integração (backend e shared);
  React Testing Library + Vitest para componentes do frontend; Playwright para E2E,
  já configurado no nível de repositório conforme `CLAUDE.md` (`backend` porta 3001,
  `frontend` porta 5174, `VITE_API_URL` apontando para o backend).
- **Unidade**: `shared/src/allocation/resolveScan` cobre exaustivamente os cenários de
  ADR-001 (candidato único, múltiplos candidatos, empate FIFO, excedente,
  não-identificado). Cada use case do `backend` é testado isoladamente com
  `NfeGateway`/repositórios mockados via `vi.fn()`/`vi.mock`, cobrindo caminho feliz e
  todo caminho de erro (`Error` lançado). Hooks e componentes do `frontend`
  (`useBarcodeScanner`, `useOfflineQueue`, telas de bipagem/relatório) testados com
  mocks na borda de I/O (câmera, IndexedDB, `fetch`).
- **Integração**: suíte contra uma instância real do `backend` (via `fetch`, sem
  Supertest, conforme convenção do projeto) e um Postgres de teste real (schema
  aplicado via migration), cobrindo os endpoints ponta a ponta dentro do processo HTTP:
  fluxo de busca de nota (com `NfeGateway` real apontando para um XML de fixture, não
  para a API real da Cacau Show), bipagem, alocação multi-nota, finalização, sincronização
  offline em lote e idempotência por `client_event_id`.
- **E2E**: Playwright cobrindo os jornadas completas de `_user_stories.md`: login →
  busca de nota → bipagem sequencial → nota completa; login → duas notas simultâneas →
  bipagem ambígua → alocação correta (cenário de referência da trufa, ADR-001); bipagem
  offline (simulando `context.setOffline(true)`) → reconexão → sincronização; finalização
  manual de nota incompleta → relatório; login como gerente → histórico → relatório de
  nota específica.
- **Fixtures**: o XML de exemplo já fornecido
  (`004005647.xml`) serve de fixture de referência para os testes de parsing do
  `NfeGateway` e para os cenários de bipagem multi-nota (variações com produtos
  adicionais/compartilhados construídas a partir dele).

## Development Sequencing

### Build Order

1. `shared` — tipos de domínio e `resolveScan` (sem dependências).
2. `backend` — scaffold do bounded context (migrations Drizzle), `domain`
   (entidades `Note`, `NoteItem`), `NfeGateway` + parsing de XML, repositórios,
   use cases (`SearchNote`, `ApplyScanEvent`, `FinalizeNote`, `SyncScanEvents`),
   controllers, autenticação (`AuthModule`, `AuthGuard`, `RoleGuard`). Depende de
   `shared`.
3. `frontend` — app shell autenticado, tela de busca/fila de notas, tela de bipagem
   (`useBarcodeScanner`), tela de relatório, histórico gerencial. Depende do contrato de
   API do `backend` e de `shared` (para o feedback local imediato).
4. Camada offline do `frontend` — armazenamento local (IndexedDB), fila de sincronização,
   `vite-plugin-pwa`/service worker, manifest instalável. Depende do passo 3.
5. `playwright.config.ts` + suíte E2E na raiz. Depende de `backend` e `frontend`
   funcionais.
6. Infraestrutura de deploy (`docker-compose.prod.yaml`, Caddy, provisionamento do VPS).
   Depende de `backend`/`frontend` com build de produção estável.

### Technical Dependencies

- Confirmação de que o VPS escolhido alcança
  `http://hybrisreports.cacaushow.com.br` pela internet pública (bloqueante para a
  Core Feature 1 em produção; ver ADR-011).
- Validação física de que o código de barras impresso na caixa corresponde a `cProd`
  do XML (bloqueante para validar a taxa de acerto real do match automático, ADR-002;
  não bloqueia o início da implementação, que já assume esse fallback via seleção
  manual).

## Monitoring and Observability

Dado o porte (uma única loja, um operador por vez), a observabilidade é deliberadamente
enxuta:
- Logs estruturados do `backend` (via `Logger` do NestJS) para: chamadas ao
  `NfeGateway` (sucesso/latência/falha), eventos de bipagem aplicados (contagem por
  `result`), lotes de sincronização processados (`applied`/`duplicates`), falhas de
  autenticação.
- Sem stack de métricas/alerting dedicada nesta fase — logs de container
  (`docker compose logs`) são suficientes na escala atual. Reavaliar se o número de
  lojas atendidas crescer (fora do escopo desta versão, ver PRD Non-Goals).

## Technical Considerations

### Key Decisions

- **Monorepo com pacote `shared`** para o motor de alocação, evitando duas
  implementações divergentes da regra mais sensível do produto (ADR-006).
- **Log de eventos append-only + contador denormalizado** para equilibrar
  rastreabilidade/idempotência com leitura rápida de progresso (ADR-007).
- **Scanner via biblioteca open-source baseada em WASM**, sem custo de licença, isolado
  atrás de um hook para permitir troca futura (ADR-008).
- **Sessão JWT curta (8h) em cookie `httpOnly`**, priorizando segurança sobre
  conveniência de nunca relogar (ADR-009).
- **Sincronização offline assume um único dispositivo ativo**, sem UI de resolução de
  conflito — escopo explicitamente reduzido pelo usuário (ADR-010).
- **Deploy em VPS próprio via Docker Compose + Caddy**, reaproveitando o padrão de
  orquestração já convencionado no projeto (ADR-011).
- **Caixas não identificadas são reivindicadas pela primeira nota finalizada depois
  delas**, evitando introduzir uma entidade "sessão de conferência" separada só para
  esse propósito — mantém o modelo de dados no mínimo necessário.

### Known Risks

- **Alcançabilidade da API Cacau Show a partir do VPS** (provável risco mais alto):
  o endpoint parece pertencer à rede de relatórios interna da Cacau Show; se não for
  publicamente alcançável, a Core Feature 1 não funciona em produção sem VPN/túnel
  adicional. Mitigação: validar conectividade antes de finalizar a escolha do provedor
  de VPS; se necessário, prever um túnel/VPN como trabalho adicional fora deste
  TechSpec.
- **Ausência de autenticação aparente na API Cacau Show**: sem token/chave visível na
  URL fornecida, o que é incomum para uma integração de produção. Mitigação: confirmar
  com a Cacau Show se há alguma forma de controle de acesso (IP allowlist, VPN) antes do
  go-live.
- **Contrato de erro da API Cacau Show desconhecido** (como ela sinaliza "nota não
  encontrada" vs. erro): o design assume heuristicamente que uma resposta sem `nfeProc`
  válido é "não encontrada". Mitigação: ajustar o parsing assim que o comportamento real
  da API for observado em teste manual.
- **Taxa de leitura do scanner open-source em condições ruins** (baixa luz, código
  amassado) pode ser inferior a um SDK comercial (ADR-008). Mitigação: fallback de
  seleção manual (US-006) sempre disponível; reavaliar biblioteca após uso real.
- **Correspondência `cProd` ↔ código de barras físico não validada fisicamente**
  (herdado do PRD, ADR-002). Mitigação: mesma — fallback manual sempre disponível.

## Architecture Decision Records

- [ADR-001: Alocação dinâmica de bipagens entre notas concorrentes por proximidade de conclusão](adrs/adr-001.md)
- [ADR-002: Identificação de item por código de produto interno (cProd), com fallback manual e registro de divergência](adrs/adr-002.md)
- [ADR-003: Operação offline-first para bipagem, com sincronização posterior](adrs/adr-003.md)
- [ADR-004: Modelo de papéis com login individual (operador e gerente/dono)](adrs/adr-004.md)
- [ADR-005: Busca de nota por número de faturamento via API interna Cacau Show, sem QR code](adrs/adr-005.md)
- [ADR-006: Monorepo com pacote compartilhado para o motor de alocação](adrs/adr-006.md)
- [ADR-007: Log de eventos de bipagem append-only com contadores denormalizados](adrs/adr-007.md)
- [ADR-008: Leitura de código de barras via biblioteca open-source baseada em WASM](adrs/adr-008.md)
- [ADR-009: Sessão de autenticação curta (8h) via JWT em cookie httpOnly](adrs/adr-009.md)
- [ADR-010: Sincronização offline assume um único dispositivo ativo por loja](adrs/adr-010.md)
- [ADR-011: Deploy em VPS próprio via Docker Compose com reverse proxy TLS](adrs/adr-011.md)
