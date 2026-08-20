# User Stories: Conferência de Notas Fiscais

Catálogo canônico de comportamento para o PWA de conferência de notas fiscais da loja
Cacau Show. Companheiro de `_prd.md`; consumido por `_techspec.md` (mapeamento de
componentes) e `_tests.md` (matriz de cobertura).

## Personas

- **Operador de estoque** — funcionário da loja que recebe as notas fiscais impressas
  na entrega, digita o número de faturamento de cada nota, e confere fisicamente
  as caixas recebidas bipando o código de barras de cada uma no celular.
- **Gerente/Dono da loja** — responsável pela loja franqueada; não realiza a bipagem,
  mas precisa consultar o histórico de conferências já realizadas e os relatórios de
  divergência para acompanhar recebimentos e cobrar fornecedores quando algo falta.

## Story Index

| ID     | Feature Area                  | Persona            | Story                                                              |
|--------|--------------------------------|---------------------|---------------------------------------------------------------------|
| US-001 | Entrada da nota                | Operador            | Buscar nota digitando o número de faturamento                       |
| US-002 | Entrada da nota                | Operador            | *(withdrawn)* Buscar nota escaneando o QR code do DANFE             |
| US-003 | Entrada da nota                | Operador            | Ver erro claro quando a busca da nota falha                         |
| US-004 | Conferência de caixas          | Operador            | Bipar caixa e ver confirmação imediata do item                      |
| US-005 | Conferência de caixas          | Operador            | Ser impedido de ultrapassar a quantidade esperada de um item        |
| US-006 | Conferência de caixas          | Operador            | Selecionar manualmente o item quando a bipagem não tem correspondência |
| US-007 | Conferência de caixas          | Operador            | Registrar caixa como não identificada quando não encontra o item    |
| US-008 | Conferência multi-nota         | Operador            | Registrar mais de uma nota para conferência ao mesmo tempo          |
| US-009 | Conferência multi-nota         | Operador            | Ter bipagens ambíguas alocadas automaticamente à nota mais próxima de completar |
| US-010 | Finalização e relatório        | Operador            | Concluir automaticamente uma nota 100% conferida                    |
| US-011 | Finalização e relatório        | Operador            | Finalizar manualmente uma nota incompleta                           |
| US-012 | Finalização e relatório        | Operador            | Ver relatório de divergência ao final da conferência                |
| US-013 | Operação offline               | Operador            | Continuar bipando caixas sem conexão à internet                     |
| US-014 | Operação offline               | Operador            | Ter o progresso sincronizado automaticamente ao voltar a conexão    |
| US-015 | Acesso                         | Operador / Gerente  | Entrar no sistema com login individual e papel associado            |
| US-016 | Histórico gerencial            | Gerente/Dono        | Consultar histórico de conferências já realizadas                   |
| US-017 | Histórico gerencial            | Gerente/Dono        | Consultar o relatório de divergência de uma nota específica         |

## Entrada da nota

### US-001: Buscar nota digitando o número de faturamento

**As a** operador de estoque, **I want** digitar o número de faturamento da nota
impressa, **so that** o sistema busque automaticamente, na API interna da Cacau Show,
os produtos e quantidades esperados sem eu precisar cadastrá-los manualmente.

Acceptance criteria:

- AC-1: Given a tela de entrada de nota, when o operador digita um número de
  faturamento válido (ex: `004005647`) e confirma, then o sistema busca o XML na API
  interna da Cacau Show e exibe a lista de produtos e quantidades esperados.
- AC-2: Given uma nota já buscada com sucesso, when o operador confirma a entrada,
  then a nota passa a fazer parte da fila de notas em conferência.

Edge cases:

- EC-1: Número de faturamento em formato claramente inválido (vazio, com caracteres
  não numéricos) → campo rejeita e mostra mensagem de formato inválido antes mesmo de
  chamar a API. (Quantidade exata de dígitos esperada depende do contrato real da API —
  ver Open Questions do PRD.)
- EC-2: Operador digita o número de faturamento de uma nota que já está na fila de
  conferência (duplicada) → sistema avisa que a nota já foi adicionada e não cria uma
  entrada duplicada.
- EC-3: Campo de número de faturamento vazio ao confirmar → botão de busca fica
  desabilitado ou mostra mensagem pedindo o preenchimento.

### US-002: *(withdrawn)* Buscar nota escaneando o QR code do DANFE

Removida: o número de faturamento não está codificado no QR code do DANFE (que carrega
a chave de acesso da NFe), então a leitura de QR code na entrada da nota deixou de
fazer sentido. Ver [ADR-005](adrs/adr-005.md). A leitura por câmera do produto fica
restrita à etapa de bipagem de caixas (US-004 em diante).

### US-003: Ver erro claro quando a busca da nota falha

**As a** operador de estoque, **I want** entender claramente por que a busca de uma
nota falhou, **so that** eu saiba se devo corrigir o código, tentar de novo, ou
aguardar o serviço voltar, sem travar a conferência das outras notas.

Acceptance criteria:

- AC-1: Given um número de faturamento válido no formato mas não encontrado na API
  interna da Cacau Show, when a busca é feita, then o sistema exibe uma mensagem
  específica de "nota não encontrada" e permite tentar novamente ou corrigir o número.
- AC-2: Given a API da Cacau Show indisponível ou com timeout, when a busca é feita,
  then o sistema exibe uma mensagem específica de "serviço indisponível, tente
  novamente" sem travar o restante do app.
- AC-3: Given uma falha de busca em qualquer nota, when o operador tem outras notas já
  em conferência, then essas notas continuam totalmente acessíveis e operáveis.

Edge cases:

- EC-1: Falha de busca ocorre enquanto o operador está offline → mensagem indica que é
  necessário estar conectado para buscar uma nova nota (distinta da mensagem de nota
  não encontrada).
- EC-2: Falha de busca repetida no mesmo código diversas vezes seguidas → sistema
  continua permitindo novas tentativas sem bloquear por número de tentativas.

## Conferência de caixas

### US-004: Bipar caixa e ver confirmação imediata do item

**As a** operador de estoque, **I want** bipar o código de barras de cada caixa com a
câmera do celular e ver na hora quantas caixas daquele produto já foram confirmadas,
**so that** eu tenha certeza de que a caixa foi contabilizada corretamente antes de
seguir para a próxima.

Acceptance criteria:

- AC-1: Given uma nota em conferência com itens pendentes, when o operador bipa o
  código de barras de uma caixa que corresponde a um item pendente, then o contador
  daquele item é incrementado (ex: "3/8 caixas confirmadas") e o sistema mostra
  feedback visual imediato de sucesso.
- AC-2: Given um item cuja quantidade esperada foi totalmente confirmada, when a última
  caixa correspondente é bipada, then o item é marcado como completo na lista da nota.
- AC-3: Given todos os itens de uma nota completos, when a última bipagem ocorre, then
  a nota é automaticamente concluída (ver US-010).

Edge cases:

- EC-1: Bipagens em sequência muito rápida (câmera detecta o mesmo frame duas vezes)
  → sistema debounce a leitura e conta apenas uma bipagem por caixa física apresentada.
- EC-2: Código de barras borrado/de baixa qualidade → leitor não confirma até obter uma
  leitura válida; não incrementa contagem com leitura parcial/incerta.
- EC-3: Zero itens pendentes na nota (todos já completos) no momento da bipagem →
  sistema trata como bipagem sem correspondência de item pendente (ver US-006).

### US-005: Ser impedido de ultrapassar a quantidade esperada de um item

**As a** operador de estoque, **I want** ser avisado quando bipar uma caixa além da
quantidade esperada para aquele produto, **so that** uma bipagem repetida por engano
não gere uma contagem incorreta.

Acceptance criteria:

- AC-1: Given um item cuja quantidade esperada já foi 100% confirmada, when o operador
  bipa novamente uma caixa desse mesmo produto, then o sistema mostra um aviso de
  "quantidade já atingida" e não incrementa o contador além do esperado.
- AC-2: Given o aviso de quantidade excedida, when o operador reconhece o aviso, then
  ele pode optar por registrar a caixa excedente como divergência (caixa extra) no
  relatório final da nota, se aplicável.

Edge cases:

- EC-1: Bipagem excedente ocorre em um produto compartilhado entre duas notas em
  aberto, mas ambas já completas para esse item → aviso de quantidade excedida é
  mostrado normalmente, sem tentar realocar para outra nota.
- EC-2: Bipagem excedente repetida várias vezes seguidas para o mesmo item → cada
  tentativa mostra o aviso novamente, sem acumular divergências duplicadas até
  confirmação do operador.

### US-006: Selecionar manualmente o item quando a bipagem não tem correspondência

**As a** operador de estoque, **I want** escolher manualmente a qual item da nota uma
caixa pertence quando o código bipado não é reconhecido automaticamente, **so that** eu
não fique travado por um código de barras que o sistema não conseguiu casar sozinho.

Acceptance criteria:

- AC-1: Given uma bipagem cujo código não corresponde a nenhum item pendente de nenhuma
  nota em aberto, when a leitura é feita, then o sistema mostra um aviso de "código não
  reconhecido" e oferece a lista de itens pendentes para seleção manual.
- AC-2: Given a lista de seleção manual, when o operador escolhe o item correto, then a
  bipagem é contabilizada normalmente para esse item, seguindo a mesma lógica de
  alocação entre notas descrita em US-009 quando aplicável.

Edge cases:

- EC-1: Nenhuma nota em aberto tem itens pendentes (todas completas) → seleção manual
  não é oferecida; a bipagem vai direto para o fluxo de "caixa não identificada"
  (US-007).
- EC-2: Operador cancela a seleção manual sem escolher nenhum item → a bipagem não é
  contabilizada e o item permanece pendente como estava.

### US-007: Registrar caixa como não identificada quando não encontra o item

**As a** operador de estoque, **I want** marcar uma caixa como "não identificada"
quando não encontro a qual item ela corresponde nem manualmente, **so that** eu possa
seguir a conferência sem perder o registro dessa caixa para revisão posterior.

Acceptance criteria:

- AC-1: Given o fluxo de seleção manual (US-006) sem nenhum item correspondente
  encontrado pelo operador, when ele opta por não selecionar nenhum item, then o
  sistema oferece a opção de registrar a caixa como "extra/não identificada".
- AC-2: Given uma caixa registrada como não identificada, when a conferência da nota é
  finalizada, then essa caixa aparece explicitamente no relatório final da sessão de
  conferência daquele momento.

Edge cases:

- EC-1: Múltiplas caixas não identificadas na mesma sessão → todas aparecem listadas
  individualmente no relatório, sem serem agrupadas/perdidas.
- EC-2: Caixa não identificada é registrada, mas nenhuma nota está em conferência no
  momento (situação anômala) → sistema impede a ação, já que não há sessão de
  conferência ativa para associar o registro.

## Conferência multi-nota

### US-008: Registrar mais de uma nota para conferência ao mesmo tempo

**As a** operador de estoque, **I want** adicionar mais de uma nota fiscal à fila de
conferência de uma vez, **so that** eu consiga conferir uma entrega que chegou com
várias notas ao mesmo tempo, sem precisar terminar uma antes de sequer começar a
registrar a próxima.

Acceptance criteria:

- AC-1: Given uma nota já em conferência (com itens pendentes), when o operador busca
  e confirma uma segunda nota (US-001), then ambas passam a existir simultaneamente na
  fila de conferência, cada uma com seu próprio progresso.
- AC-2: Given duas ou mais notas em aberto, when o operador visualiza a fila, then vê
  claramente o progresso individual de cada nota.

Edge cases:

- EC-1: Operador tenta registrar a mesma nota já presente na fila → sistema recusa
  como duplicata (ver US-001 EC-3).
- EC-2: Grande número de notas em aberto simultaneamente (ex: 10+) → a fila continua
  funcional e cada uma mantém seu progresso independente, sem degradar a experiência.

### US-009: Ter bipagens ambíguas alocadas automaticamente à nota mais próxima de completar

**As a** operador de estoque, **I want** que o sistema decida sozinho a qual nota
creditar uma bipagem quando o produto está pendente em mais de uma nota em aberto,
**so that** eu não precise indicar manualmente de qual nota é cada caixa, e o sistema
sempre avance na direção de completar uma nota inteira antes de outra.

Acceptance criteria:

- AC-1: Given duas notas em aberto com o mesmo produto pendente em ambas, when o
  operador bipa uma caixa desse produto, then o sistema credita a bipagem à nota cujo
  percentual de conclusão total fica maior após essa bipagem.
- AC-2: Given um produto pendente em apenas uma das notas em aberto (item exclusivo),
  when esse produto é bipado, then a bipagem é creditada exclusivamente a essa nota,
  mesmo que outro produto da mesma bipada esteja pendente também em outra nota.
- AC-3: Given o cenário de referência (Nota 1 com 10 caixas de panetone pendentes; Nota
  2 com 10 caixas de panetone e 1 caixa de trufa pendentes), when o operador bipa 10
  panetones e 1 trufa em qualquer ordem, then a Nota 2 termina 100% completa e a Nota 1
  permanece com todos os seus itens em falta.

Edge cases:

- EC-1: Empate exato de percentual de conclusão resultante entre duas notas candidatas
  → bipagem é creditada à nota registrada há mais tempo na fila (FIFO).
- EC-2: Três ou mais notas em aberto compartilhando o mesmo produto pendente →
  a mesma regra de maior percentual de conclusão resultante se aplica entre todas as
  candidatas, não apenas um par.
- EC-3: Uma das notas candidatas é finalizada manualmente como incompleta (US-011)
  enquanto ainda tinha aquele item pendente → ela deixa de ser candidata para futuras
  alocações automáticas desse produto.
- EC-4: Bipagem ambígua ocorre em modo offline com múltiplas notas em aberto no mesmo
  dispositivo → alocação é decidida localmente com o estado local disponível, sem
  esperar sincronização.

## Finalização e relatório

### US-010: Concluir automaticamente uma nota 100% conferida

**As a** operador de estoque, **I want** que o sistema me avise assim que uma nota
tiver todos os seus itens confirmados, **so that** eu saiba imediatamente que aquela
entrega está correta e completa.

Acceptance criteria:

- AC-1: Given uma nota com todos os itens pendentes, when a última caixa necessária é
  bipada (diretamente ou via alocação automática de US-009), then o sistema marca a
  nota como concluída e exibe uma confirmação clara de "nota completa" com o resumo dos
  itens conferidos.
- AC-2: Given uma nota concluída, when o operador consulta a fila de conferência, then
  essa nota aparece com status de completa e não recebe mais bipagens automáticas.

Edge cases:

- EC-1: Nota é concluída enquanto outra nota ainda está em aberto → a nota concluída
  sai do conjunto de candidatas de alocação de US-009; a(s) nota(s) restante(s)
  continua(m) recebendo bipagens normalmente.
- EC-2: Nota concluída tem também caixas registradas como "não identificadas" durante
  o processo (US-007) → a confirmação de "completa" ainda é exibida para os itens da
  nota, mas o relatório final também lista as caixas não identificadas daquela sessão.

### US-011: Finalizar manualmente uma nota incompleta

**As a** operador de estoque, **I want** finalizar a conferência de uma nota mesmo
quando ainda faltam caixas, **so that** o sistema gere o relatório de divergência assim
que eu confirmar que não vai chegar mais nada daquela entrega.

Acceptance criteria:

- AC-1: Given uma nota com itens ainda pendentes, when o operador aciona "Finalizar
  conferência", then o sistema pede confirmação explícita informando quantos itens
  ainda estão pendentes.
- AC-2: Given a confirmação do operador, when ele confirma a finalização mesmo
  incompleta, then a nota é marcada como finalizada com divergência e o relatório de
  itens faltantes é gerado (US-012).

Edge cases:

- EC-1: Operador aciona "Finalizar conferência" em uma nota que já está 100% completa
  → ação é redundante; sistema apenas confirma a conclusão já registrada (mesmo
  resultado de US-010), sem gerar divergência.
- EC-2: Operador cancela a confirmação de finalização incompleta → nota permanece em
  aberto, sem alteração de estado, e continua elegível para bipagens e alocação
  automática (US-009).

### US-012: Ver relatório de divergência ao final da conferência

**As a** operador de estoque, **I want** ver um relatório claro do que faltou (ou a
confirmação de que está tudo certo) ao final da conferência de cada nota, **so that**
eu saiba exatamente o que reportar ao fornecedor ou ao gerente da loja.

Acceptance criteria:

- AC-1: Given uma nota finalizada como completa (US-010), when o operador visualiza o
  relatório, then vê a confirmação de que todos os itens foram conferidos, sem itens
  pendentes.
- AC-2: Given uma nota finalizada como incompleta (US-011), when o operador visualiza o
  relatório, then vê a lista específica de quais produtos e quantas caixas de cada um
  ainda estavam faltando.
- AC-3: Given uma nota com caixas registradas como não identificadas durante a sessão
  (US-007), when o relatório é exibido, then essas caixas aparecem listadas
  separadamente das divergências de itens faltantes.

Edge cases:

- EC-1: Nota finalizada como incompleta mas sem nenhum item confirmado (zero
  bipagens) → relatório lista todos os itens da nota como 100% faltantes.
- EC-2: Nota com quantidade excedente registrada como divergência (US-005 AC-2) →
  relatório também lista os itens com excedente, além dos faltantes.

## Operação offline

### US-013: Continuar bipando caixas sem conexão à internet

**As a** operador de estoque, **I want** continuar bipando as caixas de uma nota já
carregada mesmo se a conexão do estoque cair, **so that** uma queda de Wi-Fi não pare a
minha conferência no meio do trabalho.

Acceptance criteria:

- AC-1: Given uma nota já carregada com sucesso (itens e quantidades disponíveis
  localmente), when a conexão à internet é perdida, then o operador continua bipando
  caixas normalmente, com contagem e alocação entre notas funcionando localmente.
- AC-2: Given o app operando offline, when o operador tenta buscar uma nota nova
  (US-001), then o sistema informa que essa ação específica exige conexão,
  sem afetar as notas já em conferência.

Edge cases:

- EC-1: App é fechado/o processo é reiniciado enquanto offline → progresso de bipagem
  já realizado permanece salvo localmente ao reabrir o app.
- EC-2: Finalização manual de uma nota incompleta (US-011) ocorre enquanto offline →
  a finalização é aceita localmente e entra na fila de sincronização.

### US-014: Ter o progresso sincronizado automaticamente ao voltar a conexão

**As a** operador de estoque, **I want** que meu progresso de bipagem feito offline
seja enviado automaticamente para o sistema assim que a internet voltar, **so that** eu
não precise fazer nada manualmente para não perder o trabalho registrado offline.

Acceptance criteria:

- AC-1: Given bipagens realizadas enquanto offline, when a conexão é restabelecida,
  then o sistema sincroniza automaticamente esse progresso com o backend, sem exigir
  ação do operador.
- AC-2: Given uma sincronização concluída com sucesso, when o gerente/dono consulta o
  histórico (US-016), then os dados sincronizados já aparecem refletidos.

Edge cases:

- EC-1: Conexão cai novamente no meio da sincronização → sistema retenta
  automaticamente sem duplicar ou perder bipagens já confirmadas localmente.
- EC-2: Sincronização de bipagens feitas offline entra em conflito com o mesmo produto
  já alocado de forma diferente em outro dispositivo (dois operadores) → sistema
  precisa reconciliar sem perder registros de nenhum dos dois lados (regra de
  resolução exata fica para o TechSpec; PRD assume um operador ativo por sessão como
  cenário principal).

## Acesso

### US-015: Entrar no sistema com login individual e papel associado

**As a** operador ou gerente/dono, **I want** entrar no sistema com minha própria conta
individual, **so that** o histórico de conferências saiba exatamente quem fez cada uma,
e eu só veja as telas relevantes ao meu papel.

Acceptance criteria:

- AC-1: Given uma conta individual válida associada ao papel "operador", when o login
  é feito, then o usuário tem acesso ao fluxo de busca de nota e bipagem de caixas.
- AC-2: Given uma conta individual válida associada ao papel "gerente/dono", when o
  login é feito, then o usuário tem acesso ao histórico de conferências e relatórios de
  divergência, sem acesso ao fluxo de bipagem operacional.

Edge cases:

- EC-1: Credenciais inválidas → login rejeitado com mensagem genérica de erro, sem
  indicar se o usuário existe ou não.
- EC-2: Sessão expirada durante uma conferência em andamento → operador é solicitado a
  autenticar novamente, sem perder o progresso de bipagem já salvo localmente.
- EC-3: Tentativa de acessar uma tela do papel gerente/dono estando autenticado como
  operador (ou vice-versa) → acesso é negado com mensagem explicando a restrição de
  papel.

## Histórico gerencial

### US-016: Consultar histórico de conferências já realizadas

**As a** gerente/dono da loja, **I want** ver a lista de todas as notas já conferidas,
**so that** eu tenha visibilidade do que já foi recebido e processado, mesmo sem estar
presente durante a conferência física.

Acceptance criteria:

- AC-1: Given notas já finalizadas (completas ou incompletas), when o gerente/dono
  acessa o histórico, then vê a lista com identificação da nota, status
  (completa/incompleta), quem conferiu e quando.
- AC-2: Given o histórico, when o gerente/dono filtra ou ordena por status, then
  consegue distinguir rapidamente notas completas de notas com divergência.

Edge cases:

- EC-1: Nenhuma nota finalizada ainda (primeiro uso do sistema) → histórico mostra
  estado vazio com mensagem apropriada, sem erro.
- EC-2: Grande volume de notas no histórico (ex: meses de uso acumulado) → lista
  continua navegável, sem degradar a experiência de consulta.

### US-017: Consultar o relatório de divergência de uma nota específica

**As a** gerente/dono da loja, **I want** abrir o relatório detalhado de uma nota
específica do histórico, **so that** eu tenha os dados exatos para cobrar o fornecedor
quando algo faltou na entrega.

Acceptance criteria:

- AC-1: Given uma nota incompleta no histórico, when o gerente/dono a seleciona, then
  vê o mesmo relatório de divergência gerado ao operador na finalização (US-012),
  incluindo itens faltantes, excedentes e caixas não identificadas.
- AC-2: Given uma nota completa no histórico, when o gerente/dono a seleciona, then vê
  a confirmação de conferência total, sem itens pendentes.

Edge cases:

- EC-1: Nota do histórico foi sincronizada de um dispositivo que ficou offline por um
  tempo (US-014) → relatório reflete o estado final já sincronizado, sem mostrar dados
  parciais/desatualizados.
- EC-2: Gerente/dono tenta acessar uma nota que ainda está em conferência (não
  finalizada) → sistema indica que a conferência ainda está em andamento, sem exibir um
  relatório final prematuro.
