# Test Specification: Conferência de Notas Fiscais

Canonical test contract for conferência de notas fiscais. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- **Frameworks e harnesses**: Vitest para testes de unidade e integração em `shared` e
  `backend`; Vitest + React Testing Library para `frontend`; Playwright (já convencionado
  na raiz do repositório via `CLAUDE.md`) para E2E. Fakes (`vi.fn`/`vi.mock`) apenas nas
  bordas de I/O: `NfeGateway` (HTTP externo), repositórios (quando o teste é de unidade
  de use case), câmera/`MediaStream`, IndexedDB, `fetch` do frontend.
- **Execução**: `npm run test` (Vitest) roda unidade + integração de cada workspace;
  integração usa uma instância real do `backend` (`app.listen()`) e um Postgres de teste
  real com o schema migrado, acessado via `fetch` (sem Supertest, conforme
  `vitest-testing`). `npm run test:e2e` na raiz sobe `backend` (3001) e `frontend`
  (5174) via `playwright.config.ts`.
- **Convenções**: Arrange-Act-Assert; um comportamento observável por caso; testes de
  unidade não dependem uns dos outros nem de ordem de execução; `beforeEach`/`afterEach`
  para setup/teardown de mocks, timers falsos e conexões de teste.
- **Fixtures**: `004005647.xml` (nota de exemplo real) é a fixture canônica para o
  parsing do `NfeGateway` e para os cenários de bipagem; variações derivadas dela
  (produto exclusivo adicional, item já sem GTIN) cobrem o cenário de referência
  multi-nota do ADR-001.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | Buscar nota por número de faturamento | UT-053, UT-056 | IT-001 | E2E-001 |
| US-001.EC-1 | Formato inválido rejeitado antes da API | UT-056 | — | — |
| US-001.EC-2 | Nota duplicada na fila | — | IT-002 | — |
| US-001.EC-3 | Campo vazio ao confirmar | UT-056 | — | — |
| US-002 | *(withdrawn)* QR code | — | — | — |
| US-003 | Erro claro na busca | UT-054, UT-055 | IT-003, IT-004 | E2E-005 |
| US-003.EC-1 | Falha de busca offline | UT-057 | — | — |
| US-003.EC-2 | Falha repetida, retries ilimitados | — | — | E2E-005 |
| US-004 | Bipar com feedback imediato | UT-058 | IT-005, IT-006 | E2E-001 |
| US-004.EC-1 | Debounce de frame duplicado | UT-046 | — | — |
| US-004.EC-2 | Código borrado não confirma | UT-047 | — | — |
| US-004.EC-3 | Zero itens pendentes na bipagem | UT-021, UT-025 | — | E2E-003 |
| US-005 | Impedir ultrapassar quantidade | UT-022, UT-059 | IT-005 | — |
| US-005.EC-1 | Excedente em produto de duas notas completas | UT-006 | — | — |
| US-005.EC-2 | Excedente repetido não acumula | UT-059 | — | — |
| US-006 | Seleção manual do item | UT-023, UT-060 | — | E2E-003 |
| US-006.EC-1 | Sem pendentes, vai direto a não identificada | UT-025 | — | — |
| US-006.EC-2 | Cancela seleção sem escolher | UT-061 | — | — |
| US-007 | Registrar caixa não identificada | UT-025 | IT-008 | E2E-003 |
| US-007.EC-1 | Múltiplas não identificadas listadas individualmente | — | IT-019 | — |
| US-007.EC-2 | Nenhuma nota ativa impede o registro | UT-027 | — | — |
| US-008 | Múltiplas notas simultâneas | — | IT-009 | E2E-002 |
| US-008.EC-1 | Nota duplicada na fila | — | IT-002 | — |
| US-008.EC-2 | Muitas notas abertas (10+) | — | IT-020 | — |
| US-009 | Alocação automática por proximidade de conclusão | UT-001–UT-010, UT-026 | IT-009 | E2E-002 |
| US-009.EC-1 | Empate exato, desempate FIFO | UT-004 | — | — |
| US-009.EC-2 | Três ou mais notas candidatas | UT-005 | — | — |
| US-009.EC-3 | Nota finalizada sai das candidatas | UT-009 | IT-021 | — |
| US-009.EC-4 | Alocação ambígua offline decidida localmente | UT-001–UT-010 (reuso client-side) | — | E2E-004 |
| US-010 | Conclusão automática ao 100% | UT-020 | IT-006 | E2E-001 |
| US-010.EC-1 | Nota concluída sai das candidatas | UT-009 | IT-021 | — |
| US-010.EC-2 | Nota completa com caixas não identificadas | UT-031 | IT-019 | — |
| US-011 | Finalizar manualmente incompleta | UT-029, UT-030 | IT-007, IT-008 | E2E-002 |
| US-011.EC-1 | Finalizar nota já completa é redundante | UT-028, UT-032 | — | — |
| US-011.EC-2 | Cancelar confirmação mantém nota aberta | UT-062 | — | — |
| US-012 | Ver relatório de divergência | UT-063, UT-064 | IT-008, IT-017 | E2E-001, E2E-002 |
| US-012.EC-1 | Zero bipagens, tudo faltante | UT-030 | — | — |
| US-012.EC-2 | Excedente listado separadamente | UT-065 | — | — |
| US-013 | Bipar offline | UT-048 | — | E2E-004 |
| US-013.EC-1 | Progresso mantido após fechar app offline | UT-051 | — | — |
| US-013.EC-2 | Finalização incompleta offline entra na fila | UT-052 | — | — |
| US-014 | Sincronização automática ao reconectar | UT-049 | IT-010 | E2E-004 |
| US-014.EC-1 | Retry sem duplicar após queda no meio do sync | UT-050 | IT-011 | — |
| US-014.EC-2 | Conflito multi-dispositivo | *(não aplicável — ADR-010 descarta o cenário)* | — | — |
| US-015 | Login individual com papel | UT-037–UT-039 | IT-012, IT-023 | E2E-006 |
| US-015.EC-1 | Credenciais inválidas | UT-037 | IT-023 | — |
| US-015.EC-2 | Sessão expirada sem perder progresso local | UT-040, UT-051 | — | — |
| US-015.EC-3 | Acesso cruzado de papel negado | UT-041, UT-042 | IT-014, IT-015 | E2E-007 |
| US-016 | Histórico de conferências | UT-066 | IT-016 | E2E-006 |
| US-016.EC-1 | Histórico vazio | UT-067 | — | — |
| US-016.EC-2 | Grande volume no histórico | — | IT-022 | — |
| US-017 | Relatório de nota específica | — | IT-008, IT-017 | E2E-006 |
| US-017.EC-1 | Nota sincronizada de dispositivo offline reflete estado final | — | IT-010, IT-011 | E2E-004 |
| US-017.EC-2 | Nota ainda em conferência não exibe relatório final | — | IT-017 | — |
| `resolveScan` (shared) | Motor de alocação | UT-001–UT-010 | — | — |
| `NfeGatewayHttp` | Consulta e parsing do XML da NFe | UT-011–UT-014 | IT-018 | — |
| `SearchNote` | Caso de uso de busca de nota | UT-015–UT-018 | IT-001–IT-004 | — |
| `ApplyScanEvent` | Caso de uso de aplicação de bipagem | UT-019–UT-027 | IT-005, IT-006, IT-009, IT-021, IT-028 | — |
| `FinalizeNote` | Caso de uso de finalização | UT-028–UT-032 | IT-007, IT-008, IT-019 | — |
| `SyncScanEvents` | Caso de uso de sincronização em lote | UT-033–UT-036 | IT-010, IT-011 | — |
| Auth (`AuthModule`, guards) | Login, sessão e papéis | UT-037–UT-043 | IT-012–IT-015, IT-023, IT-024 | — |
| `useBarcodeScanner` | Hook de leitura de código de barras | UT-044–UT-047 | — | — |
| `useOfflineQueue` | Hook de fila offline | UT-048–UT-052 | — | E2E-004 |
| `NoteSearchForm` | Componente de busca de nota | UT-053–UT-057 | — | E2E-001, E2E-005 |
| `ScanScreen` | Componente de bipagem | UT-058–UT-062 | — | E2E-001, E2E-002, E2E-003 |
| `ReportScreen` | Componente de relatório | UT-063–UT-065 | — | E2E-001, E2E-002 |
| `HistoryScreen` | Componente de histórico gerencial | UT-066, UT-067 | — | E2E-006 |
| `POST /auth/login` | Endpoint de login | — | IT-012, IT-023 | — |
| `POST /auth/logout` | Endpoint de logout | — | IT-024 | — |
| `GET /auth/me` | Endpoint de sessão atual | — | IT-012, IT-013 | — |
| `POST /notes` | Endpoint de busca/criação de nota | — | IT-001–IT-004, IT-015 | — |
| `GET /notes` | Endpoint de fila de notas | — | IT-025 | — |
| `GET /notes/:id` | Endpoint de detalhe de nota | — | IT-026, IT-027 | — |
| `POST /notes/:id/finalize` | Endpoint de finalização | — | IT-007, IT-008 | — |
| `GET /notes/:id/report` | Endpoint de relatório | — | IT-008, IT-017 | — |
| `POST /scan-events` | Endpoint de bipagem única | — | IT-005, IT-006, IT-028 | — |
| `POST /scan-events/sync` | Endpoint de sincronização em lote | — | IT-010, IT-011 | — |
| `GET /notes/history` | Endpoint de histórico | — | IT-014, IT-016, IT-022 | — |

## Unit Tests

### `resolveScan` (TechSpec: Core Interfaces — `shared/src/allocation`)

- **UT-001** (happy): nota única com item pendente — código bipado igual a `cProd` do
  item → `{kind:"matched", noteId, itemId}`.
- **UT-002** (happy): `cProd` não bate mas `cEan` bate → `{kind:"matched", ...}` via
  `cEan`.
- **UT-003** (happy): cenário de referência (nota 1: 10 panetones pendentes; nota 2: 10
  panetones + 1 trufa pendentes) — sequência de 10 bipagens de panetone + 1 de trufa, em
  qualquer ordem, resulta em todas creditadas à nota 2; nota 1 permanece com os 10
  panetones pendentes.
- **UT-004** (boundary): duas notas candidatas cujo resultado de conclusão empata
  exatamente → resolve para a nota com `openedAt` mais antigo.
- **UT-005** (boundary): três notas candidatas compartilhando o mesmo `cProd` pendente →
  seleciona corretamente a que maximiza o percentual de conclusão entre as três.
- **UT-006** (error): item já com `confirmedQty === expectedQty` na única nota que o
  contém → `{kind:"exceeded", noteId, itemId}`.
- **UT-007** (state): `scannedCode` não corresponde a nenhum item (pendente ou completo)
  de nenhuma nota aberta → `{kind:"unidentified"}`.
- **UT-008** (boundary): `openNotes` vazio → `{kind:"unidentified"}`.
- **UT-009** (state): nota com um item já completo e outro ainda pendente — bipagem do
  item pendente ainda é candidata normalmente (a nota não é excluída por inteiro).
- **UT-010** (ordering): bipar os mesmos produtos em ordens diferentes converge para o
  mesmo resultado final de alocação (independência de ordem dentro do mesmo conjunto de
  eventos).

### `NfeGatewayHttp` (TechSpec: Integration Points)

- **UT-011** (happy): `fetchByInvoiceNumber` contra a fixture `004005647.xml` retorna
  `NfeXmlData` com `chaveAcesso`, `numeroNota` e `items[0].cProd` corretos.
- **UT-012** (error): resposta HTTP de erro de rede/timeout/5xx → lança
  `NfeServiceUnavailableError`.
- **UT-013** (error): resposta 200 sem estrutura `nfeProc` reconhecível → lança
  `NfeNotFoundError`.
- **UT-014** (boundary): XML com um único `<det>` (não normalizado como array pelo
  parser) → `items` ainda assim é um array de tamanho 1.

### `SearchNote` (TechSpec: Core Interfaces)

- **UT-015** (happy): `invoiceNumber` válido, sem nota `open` duplicada → cria
  `invoice_notes`/`note_items`, retorna `status: "open"`.
- **UT-016** (error): já existe nota `open` com o mesmo `invoiceNumber` →
  `Error("Nota já está em conferência")`, sem chamar o gateway.
- **UT-017** (error): `NfeGateway` lança `NfeNotFoundError` → propagado sem alteração.
- **UT-018** (error): `NfeGateway` lança `NfeServiceUnavailableError` → propagado sem
  alteração.

### `ApplyScanEvent` (TechSpec: Core Interfaces, ADR-007)

- **UT-019** (happy): código bipado corresponde a item pendente de nota única → persiste
  `scan_event` `matched`, incrementa `note_items.confirmed_qty`.
- **UT-020** (happy): última unidade de um item completada → nota transiciona
  automaticamente para `completed`.
- **UT-021** (idempotency): mesmo `clientEventId` enviado duas vezes → segunda chamada
  retorna o resultado já gravado, sem reaplicar nem contar duas vezes.
- **UT-022** (state): código já com quantidade atingida → resultado `exceeded`,
  `confirmed_qty` não muda.
- **UT-023** (happy): `manualItemId` informado → credita diretamente a esse item,
  ignorando o algoritmo de correspondência automática.
- **UT-024** (error): `manualItemId` informado mas item já completo → resultado
  `exceeded`.
- **UT-025** (happy): `markUnidentified: true` → persiste `scan_event` `unidentified`
  com `note_id = null`.
- **UT-026** (happy): código ambíguo entre duas notas abertas → delega a `resolveScan` do
  `shared` e persiste na nota escolhida (testa a integração da fiação, não o algoritmo
  em si, já coberto em UT-001–UT-010).
- **UT-027** (error): `markUnidentified: true` sem nenhuma nota `open` no momento →
  `Error("nenhuma conferência ativa")`.

### `FinalizeNote` (TechSpec: Core Interfaces)

- **UT-028** (state): nota já `completed` → retorna o relatório existente sem alterar
  estado.
- **UT-029** (error): nota `open` com itens pendentes, `confirmIncomplete` ausente →
  `Error("Itens pendentes...")` (422).
- **UT-030** (happy): nota `open` com itens pendentes, `confirmIncomplete: true` →
  `closed_incomplete`, relatório lista produtos e quantidades faltantes.
- **UT-031** (state): existem `scan_events` `unidentified` com `note_id = null` não
  reivindicados → finalização os associa a esta nota e os inclui no relatório.
- **UT-032** (idempotency): finalizar uma nota já `closed_incomplete` novamente →
  retorna o mesmo relatório sem alterar `closedAt`.

### `SyncScanEvents` (TechSpec: Core Interfaces, ADR-010)

- **UT-033** (happy): lote de 3 eventos novos aplicados em ordem → `{applied: 3,
  duplicates: 0}`.
- **UT-034** (idempotency): lote com 1 evento cujo `clientEventId` já existe →
  `{applied: 2, duplicates: 1}`, sem contar o duplicado de novo.
- **UT-035** (ordering): a ordem de aplicação do lote é estritamente a ordem do array
  (reaplica o cenário de UT-003 através do caso de uso de sincronização).
- **UT-036** (boundary): `events: []` → `{applied: 0, duplicates: 0}`, sem erro.

### Auth (`AuthModule`, `AuthGuard`, `RoleGuard`) (TechSpec: ADR-009)

- **UT-037** (error): login com senha incorreta → rejeitado com mensagem genérica.
- **UT-038** (error): login com e-mail inexistente → mesma mensagem genérica de
  UT-037 (sem indicar se o usuário existe).
- **UT-039** (happy): login com credenciais válidas → gera JWT com claim de papel
  correta e expiração de 8h.
- **UT-040** (error): `AuthGuard` rejeita requisição com token expirado → 401.
- **UT-041** (error): `RoleGuard` rejeita `operador` numa rota `gerente`-only → 403.
- **UT-042** (error): `RoleGuard` rejeita `gerente` numa rota `operador`-only → 403.
- **UT-043** (happy): `AuthGuard` aceita requisição com token válido e não expirado.

### `useBarcodeScanner` (TechSpec: ADR-008)

- **UT-044** (happy): decodifica um frame válido e dispara `onScan` com o valor lido.
- **UT-045** (error): permissão de câmera negada → estado de erro específico exposto,
  sem lançar exceção não tratada.
- **UT-046** (boundary): dois frames idênticos dentro da janela de debounce → apenas um
  `onScan` disparado.
- **UT-047** (boundary): frame de baixa confiança/parcial → não dispara `onScan`.

### `useOfflineQueue` (TechSpec: ADR-003, ADR-007)

- **UT-048** (happy): sem conexão, enfileira o evento de bipagem localmente
  (IndexedDB).
- **UT-049** (happy): conexão restabelecida → drena a fila local para
  `POST /scan-events/sync` automaticamente.
- **UT-050** (idempotency): reenvio após falha parcial de rede não duplica eventos já
  confirmados pelo servidor.
- **UT-051** (state): app recarregado enquanto offline → eventos enfileirados
  continuam presentes após o reload.
- **UT-052** (state): finalização manual de nota incompleta feita offline → enfileirada
  e incluída no próximo flush de sincronização.

### Componentes do frontend (TechSpec: Implementation Design)

- **UT-053** (happy): `NoteSearchForm` submete um número de faturamento válido e exibe a
  lista de itens retornada.
- **UT-054** (error): `NoteSearchForm` mostra "nota não encontrada" na resposta 404.
- **UT-055** (error): `NoteSearchForm` mostra "serviço indisponível" na resposta 502.
- **UT-056** (boundary): `NoteSearchForm` rejeita entrada vazia/não numérica antes de
  chamar a API.
- **UT-057** (error): `NoteSearchForm` offline mostra mensagem de conexão necessária ao
  tentar buscar nota nova, sem afetar notas já carregadas.
- **UT-058** (happy): `ScanScreen` atualiza o contador de progresso do item em tempo
  real a cada bipagem.
- **UT-059** (state): `ScanScreen` mostra aviso "quantidade já atingida" sem incrementar
  o contador em resultado `exceeded`.
- **UT-060** (happy): `ScanScreen` oferece seleção manual de item quando o resultado é
  `unidentified`.
- **UT-061** (state): cancelar a seleção manual sem escolher item mantém o item
  pendente, sem enviar evento.
- **UT-062** (state): cancelar o diálogo de confirmação de finalização incompleta mantém
  a nota aberta, sem chamada à API.
- **UT-063** (happy): `ReportScreen` renderiza a lista de itens faltantes para nota
  `closed_incomplete`.
- **UT-064** (happy): `ReportScreen` renderiza a confirmação "tudo certo" para nota
  `completed`.
- **UT-065** (happy): `ReportScreen` lista itens com excedente separadamente dos
  faltantes.
- **UT-066** (happy): `HistoryScreen` lista notas finalizadas com status e quem
  conferiu.
- **UT-067** (empty): `HistoryScreen` mostra estado vazio quando não há notas
  finalizadas.

## Integration Tests

### Ciclo de vida da nota (TechSpec: `SearchNote`, `ApplyScanEvent`, `FinalizeNote`)

- **IT-001**: `POST /notes` com `invoiceNumber` válido (gateway apontando para servidor
  de fixture local) → `201`, nota persistida com itens idênticos à fixture
  `004005647.xml`.
- **IT-002**: `POST /notes` com o mesmo `invoiceNumber` de uma nota já `open` → `409`.
- **IT-003**: `POST /notes` com fixture simulando "não encontrada" → `404`.
- **IT-004**: `POST /notes` com fixture simulando timeout/erro → `502`.
- **IT-005**: `POST /scan-events` com código correspondente → `200`; `GET /notes/:id`
  em seguida reflete `confirmed_qty` incrementado.
- **IT-006**: sequência de `POST /scan-events` completando todos os itens → nota
  transiciona para `completed`; `GET /notes/:id` reflete o novo status.
- **IT-007**: `POST /notes/:id/finalize` em nota com itens pendentes, sem
  `confirmIncomplete` → `409`.
- **IT-008**: `POST /notes/:id/finalize` com `confirmIncomplete: true` → `200`;
  `GET /notes/:id/report` lista os itens faltantes.
- **IT-009**: duas notas abertas concorrentemente (fixture + variante com item
  exclusivo) — sequência de `POST /scan-events` via HTTP reproduz o cenário de
  referência do ADR-001 (nota 2 completa, nota 1 intacta).
- **IT-019**: múltiplas bipagens `unidentified` antes da finalização → cada uma
  aparece listada individualmente no relatório da nota finalizada em seguida.
- **IT-020** (scale): 10+ notas abertas simultaneamente → fila permanece funcional,
  cada nota com progresso independente.
- **IT-021**: nota A finalizada como incompleta enquanto ainda tinha item compartilhado
  pendente → bipagem seguinte desse item é alocada inteiramente à nota B.

### Sincronização offline

- **IT-010**: `POST /scan-events/sync` com lote de eventos novos → estado final
  reflete a aplicação sequencial correta.
- **IT-011**: `POST /scan-events/sync` reenviando um lote já aplicado (simulação de
  retry de rede) → duplicados contabilizados, sem dobrar a contagem.

### Autenticação e papéis

- **IT-012**: `POST /auth/login` com credenciais válidas → `200` + cookie de sessão;
  `GET /auth/me` subsequente com esse cookie → `200`.
- **IT-013**: `GET /auth/me` sem cookie de sessão → `401`.
- **IT-014**: `GET /notes/history` autenticado como `operador` → `403`.
- **IT-015**: `POST /notes` autenticado como `gerente` → `403`.
- **IT-023**: `POST /auth/login` com senha incorreta → `401`.
- **IT-024**: `POST /auth/logout` limpa o cookie; `GET /auth/me` subsequente → `401`.

### Histórico e relatório

- **IT-016**: `GET /notes/history` como `gerente` retorna apenas notas finalizadas
  (notas `open` excluídas).
- **IT-017**: `GET /notes/:id/report` numa nota ainda `open` → `409`.
- **IT-022** (scale): `GET /notes/history` com 100+ notas finalizadas → retorna a
  lista completa sem erro.

### Gateway externo

- **IT-018**: `NfeGatewayHttp` contra um servidor de fixture local servindo
  `004005647.xml` → `NfeXmlData` com todos os campos corretamente parseados.

### Validação de payload

- **IT-025**: `GET /notes?status=open` como `operador` → `200` com a fila de notas.
- **IT-026**: `GET /notes/:id` de uma nota existente → `200` com detalhe completo.
- **IT-027**: `GET /notes/:id` com id inexistente → `404`.
- **IT-028**: `POST /scan-events` com payload sem `scannedCode` → `400` de validação.

## End-to-End Tests

### Busca e bipagem completa de uma nota (US-001, US-003, US-004, US-005, US-010, US-012)

- **E2E-001**: login → digita número de faturamento válido → bipa todas as caixas →
  vê confirmação de nota completa e relatório sem pendências.

### Conferência multi-nota com alocação automática (US-008, US-009, US-010, US-011, US-012)

- **E2E-002**: login → registra duas notas (cenário de referência: 10 panetones em
  cada + 1 trufa exclusiva na segunda) → bipa 10 panetones + 1 trufa → nota 2 aparece
  completa → finaliza nota 1 manualmente incompleta → relatório da nota 1 lista os 10
  panetones como faltantes.

### Bipagem sem correspondência (US-006, US-007)

- **E2E-003**: bipagem de um código não reconhecido → seleção manual do item correto
  → contabilizado; segunda bipagem sem nenhuma correspondência possível → registrada
  como caixa não identificada.

### Operação offline (US-013, US-014)

- **E2E-004**: nota carregada → simula perda de conexão (`context.setOffline(true)`)
  → bipagens continuam funcionando com feedback local → reconecta → progresso
  sincronizado automaticamente e refletido no relatório.

### Falha de busca (US-003)

- **E2E-005**: digita número de faturamento inexistente → vê "nota não encontrada" →
  tenta novamente com número válido → busca funciona normalmente, sem afetar outras
  notas já em conferência.

### Acesso e histórico gerencial (US-015, US-016, US-017)

- **E2E-006**: login como gerente → acessa histórico → abre relatório de uma nota
  finalizada com divergência.
- **E2E-007**: tentativa de acessar a tela de bipagem autenticado como gerente →
  acesso negado.
