# PRD: Conferência de Notas Fiscais

## Overview

A loja franqueada Cacau Show recebe entregas de mercadorias acompanhadas de notas
fiscais impressas (DANFE), e hoje a conferência do que chegou fisicamente contra o que
foi faturado é um processo manual e sujeito a erro: caixas faltantes só são percebidas
depois, quando já é tarde para reclamar ao fornecedor com precisão. Esse problema é
consistente com relatos públicos de franqueados Cacau Show sobre divergência entre o
que é cobrado e o que é efetivamente entregue.

Este produto é um PWA mobile-first para o funcionário de estoque conferir, caixa por
caixa, o conteúdo de uma entrega contra os dados oficiais da nota fiscal eletrônica
(NFe), usando a câmera do celular para ler os códigos de barras das caixas. O
funcionário digita o número de faturamento da nota impressa, o sistema busca o XML da
NFe correspondente na API interna da Cacau Show, e a partir daí cada bipagem de caixa
vai confirmando os itens esperados até a nota ficar completa ou até sobrar uma lista
clara do que faltou. O produto também cobre o caso comum de chegarem várias notas na
mesma entrega, priorizando sempre a conclusão de uma nota de cada vez, e dá ao
dono/gerente da loja visibilidade posterior sobre o que foi conferido e o que divergiu.

## Goals

- O operador consegue carregar os itens esperados de uma nota fiscal sem digitar
  manualmente produtos e quantidades — apenas informando o número de faturamento da
  nota.
- O operador confere fisicamente as caixas recebidas usando apenas a câmera do celular,
  sem checklist em papel.
- Ao final da conferência de uma nota, o sistema sempre indica com certeza se ela está
  completa ou, caso não esteja, exatamente quais produtos e quantas caixas faltaram.
- Quando várias notas chegam ao mesmo tempo, o operador pode bipar as caixas misturadas
  sem se preocupar em separá-las por nota antes — o sistema decide sozinho a qual nota
  cada bipagem pertence, sempre buscando completar uma nota antes de avançar em outra.
- Bipagens repetidas ou além da quantidade esperada nunca inflam a contagem de um item
  além do que a nota realmente pede.
- Uma queda de conexão no estoque não interrompe uma conferência já em andamento.
- O dono/gerente da loja consegue consultar, depois, o histórico de conferências e os
  relatórios de divergência sem precisar estar presente durante o recebimento físico.

## User Stories

Catálogo completo em [_user_stories.md](_user_stories.md). Faixas por área:

- **Entrada da nota** (US-001 a US-003) — busca da nota por número de faturamento
  digitado (US-002 retirada) e tratamento de falha na busca.
- **Conferência de caixas** (US-004 a US-007) — bipagem com feedback imediato, limite
  de quantidade esperada, seleção manual e registro de caixa não identificada.
- **Conferência multi-nota** (US-008 e US-009) — múltiplas notas simultâneas e alocação
  automática de bipagens ambíguas.
- **Finalização e relatório** (US-010 a US-012) — conclusão automática, finalização
  manual de nota incompleta, e relatório de divergência.
- **Operação offline** (US-013 e US-014) — bipagem sem conexão e sincronização
  automática posterior.
- **Acesso e histórico gerencial** (US-015 a US-017) — login individual por papel,
  histórico de conferências e relatório por nota para o dono/gerente.

## Core Features

### 1. Busca de nota por número de faturamento

O operador digita o número de faturamento impresso na nota (ex: `004005647`). O
sistema usa esse número para buscar o XML da NFe na API interna da Cacau Show (a rota
exata dessa API será fornecida pelo usuário antes da fase de especificação técnica; ver
Open Questions) e extrai a lista de produtos, quantidades e demais dados relevantes da
nota. A nota buscada com sucesso entra na fila de conferência. Não há leitura de QR
code nesta etapa — a leitura por câmera do produto é usada apenas na bipagem de caixas
(ver ADR-005).

### 2. Conferência de caixas por leitura de código de barras

Com a nota carregada, o operador usa a câmera do celular para bipar o código de barras
de cada caixa física recebida. Cada bipagem reconhecida confirma uma unidade do item
correspondente, com feedback imediato do progresso daquele item (ex: "3/8 caixas
confirmadas"). A granularidade da conferência é a caixa, refletindo a unidade comercial
já usada na nota (tipicamente "CX" no XML), não a unidade individual dentro da caixa.

### 3. Identificação de item por código de produto

O código de barras bipado é comparado principalmente contra o código interno do produto
(`cProd`) presente no XML da nota, já que o campo de EAN/GTIN pode não estar preenchido
por alguns fornecedores (confirmado em nota de exemplo real). Quando uma bipagem não
corresponde a nenhum item pendente, o operador pode selecionar manualmente o item
correto; se ainda assim não encontrar correspondência, pode registrar a caixa como
"extra/não identificada" para revisão posterior — sem travar o restante da conferência.

### 4. Conferência simultânea de múltiplas notas

O operador pode registrar mais de uma nota fiscal na fila de conferência ao mesmo
tempo, refletindo entregas que chegam com vários documentos fiscais juntos. As caixas
podem ser bipadas fora de ordem, misturadas entre notas diferentes, sem que o operador
precise indicar manualmente a qual nota cada caixa pertence. O sistema sempre prioriza
completar uma nota de cada vez: quando um código bipado tem correspondência pendente em
mais de uma nota em aberto, a bipagem é automaticamente creditada à nota que fica mais
próxima de ficar 100% completa com aquela bipagem.

### 5. Limite de quantidade e prevenção de bipagem duplicada

Cada item tem uma quantidade esperada definida pela nota. Bipagens que ultrapassem essa
quantidade (por exemplo, a mesma caixa bipada duas vezes por engano) não incrementam a
contagem além do esperado — o sistema avisa que a quantidade já foi atingida e oferece
a opção de registrar o excedente como divergência.

### 6. Finalização e relatório de divergência

Uma nota é concluída automaticamente assim que todos os seus itens são confirmados. Se
faltar item de verdade (a entrega veio incompleta), o operador aciona explicitamente
"Finalizar conferência", confirma que quer encerrar mesmo com pendências, e o sistema
gera um relatório indicando exatamente quais produtos e quantas caixas de cada um
faltaram, além de listar eventuais caixas registradas como não identificadas ou
excedentes durante a sessão.

### 7. Operação offline com sincronização

A busca inicial de uma nota exige conexão à internet, mas uma vez carregada, a
bipagem de caixas continua funcionando integralmente offline. O progresso é
sincronizado automaticamente com o backend assim que a conexão for restabelecida, sem
exigir nenhuma ação manual do operador.

### 8. Acesso por papel e histórico gerencial

Cada pessoa acessa o sistema com login individual, associado a um papel: operador
(busca de nota e bipagem) ou gerente/dono (consulta de histórico e relatórios). O
histórico registra todas as notas já finalizadas, seu status (completa/incompleta) e
quem realizou a conferência, permitindo ao gerente/dono acompanhar recebimentos e
relatórios de divergência sem estar presente fisicamente durante a conferência.

### Interação entre features

A busca de nota (feature 1) alimenta a fila de conferência que sustenta a conferência
multi-nota (feature 4); a identificação de item (feature 3) e o limite de quantidade
(feature 5) atuam em toda bipagem, seja de uma nota única ou de várias simultâneas; a
finalização (feature 6) fecha o ciclo de cada nota individualmente, mesmo quando várias
estão em aberto ao mesmo tempo; a operação offline (feature 7) garante que as features
2 a 6 continuem funcionando sem conexão, sincronizando depois para alimentar o
histórico gerencial (feature 8).

## Business Rules

- Uma caixa bipada só é contabilizada se corresponder a um item pendente (por `cProd`,
  com `cEAN`/`cEANTrib` como alternativa) em pelo menos uma nota em aberto, ou for
  associada manualmente pelo operador a um item pendente.
- A contagem de um item nunca ultrapassa a quantidade esperada (`qCom`) definida na
  nota; bipagens além desse limite não incrementam a contagem e exigem reconhecimento
  explícito do operador para virar registro de divergência por excedente.
- Quando um código de produto tem quantidade pendente em mais de uma nota em aberto
  simultaneamente, a bipagem é alocada à nota cujo percentual de conclusão total fica
  maior após creditar essa bipagem; em empate exato, prevalece a nota registrada há
  mais tempo na fila (ver ADR-001).
- Uma nota é automaticamente marcada como completa assim que 100% dos itens esperados
  estiverem confirmados; a partir desse momento, ela deixa de ser candidata para
  alocação automática de novas bipagens ambíguas.
- Uma nota só pode ser finalizada como incompleta por ação explícita do operador
  ("Finalizar conferência"), com confirmação quando ainda houver itens pendentes.
- Uma vez finalizada (completa ou incompleta), uma nota não recebe mais bipagens; seus
  dados passam a existir apenas como registro no histórico.
- Toda caixa que não corresponde a nenhum item pendente, mesmo após seleção manual,
  deve ser registrada como "extra/não identificada" e aparecer no relatório final —
  nunca descartada silenciosamente.
- A busca de uma nota nova exige conexão à internet; a bipagem de caixas de notas já
  carregadas deve funcionar sem conexão, sincronizando o progresso automaticamente ao
  reconectar.
- Papel "operador": acesso ao fluxo de busca de nota e bipagem. Papel "gerente/dono":
  acesso ao histórico de conferências e relatórios de divergência, sem acesso ao fluxo
  operacional de bipagem. Cada conta é individual, nunca compartilhada entre pessoas.
- O sistema atende a uma única loja; não há isolamento multi-loja nesta versão.

## User Experience

### Personas

- **Operador de estoque** — recebe a entrega, tem o celular em mãos, e precisa de um
  fluxo rápido, robusto a conexão instável, que funcione bem segurando caixas com uma
  mão e o celular com a outra.
- **Gerente/Dono da loja** — consulta os resultados depois, possivelmente em outro
  dispositivo (computador ou outro celular), sem participar da conferência física.

### Fluxo principal (operador)

1. Login individual no PWA.
2. Digita o número de faturamento da nota.
3. Sistema busca o XML na API da Cacau Show e mostra a lista de produtos/quantidades
   esperados.
4. (Opcional) Repete o passo 2-3 para registrar notas adicionais recebidas na mesma
   entrega.
5. Usa a câmera para bipar cada caixa recebida; cada bipagem confirma um item, com
   feedback imediato, e é automaticamente atribuída à nota correta quando há mais de
   uma em aberto.
6. Quando uma nota atinge 100%, o sistema avisa que ela está completa.
7. Se restar algo faltando de verdade, o operador aciona "Finalizar conferência" e
   confirma o encerramento com pendências.
8. Ao final de cada nota, vê o relatório de divergência (ou confirmação de completude).

### Fluxo do gerente/dono

1. Login individual.
2. Acessa o histórico de notas já conferidas.
3. Abre uma nota específica para ver o relatório de divergência detalhado.

### Considerações de UI/UX

- Interface mobile-first, otimizada para uso com uma mão, luvas leves de estoque e
  ambientes com iluminação variável (backroom de loja).
- Toda a UI segue o `DESIGN.md` do projeto — sistema visual "Chocolate & Creme", com
  contadores grandes (fonte de destaque) para o progresso de itens conferidos, barras
  de progresso em formato pill, e paleta terracota/creme/chocolate.
- Feedback de bipagem (sucesso, item completo, quantidade excedida, código não
  reconhecido) precisa ser perceptível rapidamente durante o uso contínuo da câmera,
  sem exigir leitura de texto longo no meio do fluxo.
- Leitura de código de barras precisa funcionar de forma confiável tanto em Android
  quanto em iPhone (ver High-Level Technical Constraints).

## High-Level Technical Constraints

- **Integração obrigatória**: API interna da Cacau Show para consulta de XML de NFe por
  número de faturamento. A rota exata será fornecida pelo usuário antes da fase de
  especificação técnica (ver Open Questions).
- **Leitura de código de barras via câmera**: iOS Safari não possui suporte nativo
  confiável à Barcode Detection API; o produto precisa funcionar de forma consistente
  em Android e iPhone, o que é uma restrição de UX/produto relevante mesmo que a
  solução técnica específica (biblioteca, WASM etc.) seja decidida no TechSpec.
- **PWA instalável**: o produto deve poder ser adicionado à tela inicial do celular e
  ter uso mobile-first como caso primário; uso em desktop não é um requisito.
- **Operação offline**: a conferência de caixas (não a busca inicial da nota) deve
  continuar funcionando sem conexão à internet, sincronizando automaticamente ao
  reconectar (ver ADR-003).
- **Rastreabilidade**: toda nota finalizada deve registrar quem a conferiu e quando,
  para sustentar o histórico gerencial.
- **Privacidade e dados**: os dados manipulados incluem informações fiscais e de
  fornecedores/clientes contidas no XML da NFe (CNPJ, endereços, valores); não há
  requisito de compliance adicional além do tratamento razoável desses dados como
  informação comercial sensível da loja.

## Non-Goals (Out of Scope)

- **Multi-loja**: esta versão atende a uma única loja franqueada; não há conceito de
  múltiplas lojas/unidades com histórico isolado entre si.
- **Cancelamento/remoção de nota da fila**: uma vez que uma nota entra na fila de
  conferência, não há operação de cancelamento manual nesta versão — ela só sai
  completa ou finalizada com divergência.
- **Confêrencia cega**: o produto usa feedback ao vivo (contagem visível durante a
  bipagem), não o modelo de "conferência cega" usado em operações logísticas maiores.
- **Rastreio por lote/validade**: embora o XML da NFe possa trazer dados de lote e
  validade (`rastro`), esta versão confere apenas presença/quantidade de caixas por
  produto, sem rastrear lote ou data de validade individualmente.
- **Cadastro manual de itens da nota como alternativa à API**: quando a busca da nota
  falha, o produto mostra erro e permite tentar novamente, mas não oferece cadastro
  manual dos produtos da nota como caminho alternativo nesta versão.
- **Comunicação automática com fornecedor**: o relatório de divergência é para consumo
  interno da loja (operador/gerente); o envio desse relatório ao fornecedor não faz
  parte do escopo.
- **Leitura de QR code/chave de acesso na entrada da nota**: a busca de nota usa
  exclusivamente o número de faturamento digitado manualmente; não há suporte a leitura
  de QR code do DANFE nem busca pela chave de acesso de 44 dígitos da NFe (ver
  ADR-005).

## Architecture Decision Records

- [ADR-001: Alocação dinâmica de bipagens entre notas concorrentes por proximidade de conclusão](adrs/adr-001.md) — decide como o sistema escolhe automaticamente a qual nota creditar uma bipagem ambígua.
- [ADR-002: Identificação de item por código de produto interno (cProd), com fallback manual e registro de divergência](adrs/adr-002.md) — decide usar `cProd` como chave primária de match, dado que `cEAN` pode vir vazio.
- [ADR-003: Operação offline-first para bipagem, com sincronização posterior](adrs/adr-003.md) — decide que a bipagem funciona offline e sincroniza depois.
- [ADR-004: Modelo de papéis com login individual (operador e gerente/dono)](adrs/adr-004.md) — decide login individual por pessoa em vez de PIN compartilhado por papel.
- [ADR-005: Busca de nota por número de faturamento via API interna Cacau Show, sem QR code](adrs/adr-005.md) — decide substituir a chave de acesso de 44 dígitos e o QR code do DANFE por busca via número de faturamento contra a API própria da Cacau Show.

## Open Questions

- ~~Rota e contrato da API de consulta de NFe da Cacau Show~~ — **Resolvido no
  TechSpec**: `GET http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML?empresa=<código>&documento=<número de faturamento>`,
  retorna XML puro. Ver `_techspec.md` (Integration Points) e ADR-011.
- **Correspondência real do código de barras físico da caixa com `cProd`**: a decisão
  de usar `cProd` como chave de match (ADR-002) parte de uma nota de exemplo real, mas
  ainda não foi validada fisicamente com uma caixa e seu código de barras impresso.
  Recomenda-se validar isso com uma caixa real antes de travar a implementação do
  match automático.
- ~~Resolução de conflito de sincronização entre dois operadores offline~~ —
  **Resolvido no TechSpec**: o usuário confirmou que múltiplos dispositivos offline
  simultâneos não ocorrem na prática; o design assume um único dispositivo ativo por
  vez, sem mecanismo de resolução de conflito. Ver ADR-010.
