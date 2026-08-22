# PRD: Melhorias na fila de notas e no login

## Overview

A tela de fila de conferência de notas (`/notas`) hoje só permite buscar/abrir uma nota
e navegar até a bipagem de uma nota específica; não existe forma de descartar uma nota
aberta por engano, e continuar bipando exige sempre abrir uma nota antes. A tela de
login não oferece nenhuma forma de conferir a senha digitada antes de enviar.

Este PRD cobre três melhorias operacionais para quem usa o sistema no dia a dia da loja:

1. **Excluir nota em conferência** — dar ao operador uma saída para notas abertas por
   engano, hoje presas na fila para sempre.
2. **Bipagem rápida pela fila** — um atalho de câmera que leva direto para a bipagem,
   sem exigir que o operador escolha manualmente qual nota abrir primeiro.
3. **Ver senha no login e na troca de senha** — permitir conferir visualmente o que foi
   digitado, reduzindo erro de digitação em teclado de celular.

Os usuários são operadores de loja (para as duas primeiras melhorias) e qualquer usuário
autenticado do sistema — operador, gerente ou admin (para a melhoria de ver senha). O
valor é reduzir fricção e erro operacional em três pontos concretos do fluxo diário: fila
de notas presa, cliques extras para continuar bipando, e senha errada por erro de
digitação não percebido.

## Goals

- Um operador consegue remover uma nota da fila de conferência sem depender de ninguém
  mais, quando ela foi aberta por engano.
- A confirmação de exclusão sempre deixa claro, antes de excluir, quanto progresso de
  bipagem (se algum) será perdido — nunca é uma exclusão silenciosa.
- Um operador consegue começar a bipar direto da tela de fila, sem escolher manualmente
  qual nota abrir, quando quer só continuar o trabalho que já vinha fazendo.
- Cada card da fila passa a ter duas ações independentes e sem ambiguidade de toque: ver
  produtos da nota, e excluir a nota.
- Qualquer usuário consegue conferir visualmente a senha que digitou — no login e na
  troca de senha — antes de enviar o formulário.

## User Stories

Catálogo completo em [`_user_stories.md`](_user_stories.md):

- US-001 a US-003 — Excluir nota: fluxo de exclusão, aviso de progresso perdido, bloqueio
  offline.
- US-004 — Fila de notas: botão explícito de ver produtos no card.
- US-005 — Bipagem rápida: atalho de câmera na fila, escolha automática de nota.
- US-006 a US-007 — Ver senha: login e troca de senha.

## Core Features

### Excluir nota em conferência

Cada nota aberta (`status: open`) na fila de conferência ganha um botão de excluir no
seu card. Tocar nele abre um diálogo de confirmação — nunca exclui direto. Confirmando,
a nota, seus itens e todo o histórico de bipagens associado são removidos
permanentemente do sistema; a nota some da fila imediatamente. A ação está disponível
para qualquer usuário com papel `operador` (mesmo nível de acesso das demais ações de
nota), sem exigir aprovação de um segundo usuário. Não é permitida sem conexão — ver
Business Rules.

Interage com a bipagem rápida (abaixo): excluir a única nota aberta remanescente deixa
o atalho de bipagem indisponível, mesmo comportamento de fila vazia já existente hoje.

### Bipagem rápida pela fila

Um único botão "Bipar", fora dos cards individuais, aparece na tela de fila sempre que
houver pelo menos uma nota aberta. Tocá-lo abre a tela de bipagem direto, sem passar
pela escolha manual de nota: o sistema exibe inicialmente a nota aberta com maior
percentual de conclusão (empate resolvido pela nota aberta há mais tempo). A alocação de
cada bipagem individual entre as notas abertas continua sendo decidida pelo algoritmo de
alocação já existente do produto — este botão só muda o ponto de entrada da tela, não a
lógica de para qual nota uma caixa bipada é creditada.

Este atalho não lê nenhum código para preencher o campo de busca por número de
faturamento — essa leitura continua fora de escopo, como já decidido anteriormente (ver
Architecture Decision Records).

### Ações do card da fila

Cada card de nota na fila passa a ter dois controles explícitos e independentes, no
lugar do card inteiro ser clicável como hoje:

- **Ver produtos** — abre a tela de bipagem daquela nota específica (mesmo destino que o
  comportamento atual de tocar no card).
- **Excluir** — aciona o fluxo de exclusão descrito acima.

Os dois controles nunca disparam a ação um do outro, e tocar em qualquer outra parte do
card não aciona nada.

### Ver senha no login e na troca de senha

O campo de senha do login e os dois campos da tela de troca de senha (nova senha,
confirmação) ganham cada um seu próprio botão de alternar visibilidade (ícone de olho).
Por padrão a senha fica oculta (`type="password"`); tocar no botão alterna para texto
plano e de volta, sem tirar o foco do campo. Na troca de senha, os dois campos alternam
de forma independente — mostrar um não afeta o outro. Nenhuma preferência de
visibilidade é lembrada entre sessões ou entre telas: toda vez que a tela é aberta, a
senha começa oculta.

## Business Rules

- Uma nota só pode ser excluída enquanto seu status for `open` (em conferência). Notas
  `completed`/`closed_incomplete` não têm botão de exclusão nesta tela.
- Excluir uma nota remove permanentemente a nota, seus itens e todo o histórico de
  bipagens (`ScanEvent`) associado — não é soft delete, não há forma de reverter, e não
  fica nenhum registro de auditoria da nota excluída.
- Excluir uma nota exige confirmação explícita do operador antes de efetivar. A
  confirmação sempre declara que a ação é permanente; quando a nota já tem pelo menos
  uma caixa confirmada, a confirmação também declara explicitamente quantas caixas serão
  perdidas.
- Excluir uma nota exige o papel `operador` (mesmo nível de acesso de criar, bipar e
  finalizar notas hoje). Não há distinção entre quem abriu a nota e quem a exclui — qualquer
  operador pode excluir qualquer nota aberta.
- Excluir uma nota exige conexão online. Diferente de bipagem e finalização, a exclusão
  nunca é enfileirada para sincronizar depois: sem conexão, o botão de excluir fica
  indisponível.
- O botão de bipagem rápida da fila só fica disponível quando existe pelo menos uma nota
  aberta. Quando existe mais de uma, a nota inicialmente exibida na tela de bipagem é a
  de maior percentual de conclusão (`confirmedTotal / expectedTotal`) entre as abertas;
  empate é resolvido pela nota aberta há mais tempo (`openedAt` mais antigo) — mesmo
  critério de desempate já usado pelo algoritmo de alocação de bipagem do produto.
  Escolher a nota inicialmente exibida não restringe a quais notas as bipagens
  subsequentes podem ser creditadas.
- O botão de bipagem rápida não lê nenhum código para preencher o campo de busca de nota
  por número de faturamento — a busca continua sendo só por digitação manual.
- O campo de senha, em qualquer tela onde o botão de ver senha existir, começa sempre
  oculto por padrão. O estado de visibilidade não é persistido entre sessões, recargas de
  tela, ou entre os diferentes campos de senha de uma mesma tela.

## User Experience

**Personas**: operador de loja (excluir nota, bipagem rápida, ambas as telas de senha) e
qualquer usuário do sistema — operador, gerente, admin (ver senha).

**Fluxo — excluir nota**: operador está na fila de conferência → toca em "Excluir" no
card de uma nota → diálogo de confirmação aparece, com aviso de progresso perdido quando
aplicável → operador confirma → nota some da fila imediatamente. Cancelar o diálogo não
tem efeito nenhum.

**Fluxo — bipagem rápida**: operador está na fila, quer continuar bipando → toca no
botão "Bipar" da tela (fora dos cards) → tela de bipagem abre já na nota mais perto de
terminar → operador bipa normalmente, cada caixa creditada à nota correta.

**Fluxo — ver produtos de uma nota específica**: operador quer abrir uma nota em
particular (não necessariamente a mais próxima de terminar) → toca em "Ver produtos" no
card daquela nota → tela de bipagem abre nela.

**Fluxo — ver senha**: usuário está digitando a senha no login (ou a nova senha na troca
de senha) → toca no ícone de olho ao lado do campo → senha aparece em texto plano →
usuário confere e continua digitando ou envia o formulário.

**Considerações de UI/UX e acessibilidade**:

- Toda UI nova segue o `DESIGN.md` do projeto: paleta creme/chocolate/terracota,
  cantos super arredondados (`rounded-pill` para botões), sombras calibradas para fundo
  creme.
- O botão de excluir, por ser uma ação destrutiva, precisa de contraste e posição que o
  distingam claramente do botão de ver produtos — nenhum dos dois pode ser confundido
  com o outro por proximidade ou aparência similar.
- O botão de alternar visibilidade de senha segue o padrão de mercado consolidado: ícone
  de olho, elemento de botão real (não `div`/`span`), rótulo acessível (`aria-label`)
  descrevendo a ação e seu estado, sem tirar o foco do campo ao ser acionado.
- Nenhuma biblioteca de ícones externa é necessária — o padrão já usado no projeto
  (SVG inline, como em `NavDrawer.tsx`) cobre tanto o ícone de olho quanto qualquer ícone
  de excluir/câmera necessário.

**Descoberta**: todas as ações são descobertas diretamente na tela onde já fazem sentido
(fila de notas, telas de senha) — não exigem onboarding ou tutorial adicional.

## High-Level Technical Constraints

- A bipagem rápida reaproveita o algoritmo de alocação de bipagem já existente no
  produto (que decide a qual nota aberta creditar cada código bipado, considerando todo
  o conjunto de notas abertas) — nenhuma mudança nessa lógica de alocação faz parte
  deste PRD.
- A leitura de câmera para bipagem continua usando a solução já adotada pelo produto
  para funcionar de forma consistente em Android e iPhone — nenhuma nova biblioteca de
  leitura de código é necessária para o atalho de bipagem rápida, porque ele não lê
  nenhum código novo, só navega para a tela de bipagem já existente.
- A exclusão de nota precisa remover de forma consistente todos os dados relacionados
  (itens e histórico de bipagens) — nenhum registro órfão pode restar referenciando uma
  nota excluída.
- A exclusão de nota exige conexão de rede no momento da ação; não integra com a fila de
  sincronização offline existente.

## Non-Goals (Out of Scope)

- Recuperar ou desfazer uma nota excluída (sem lixeira, sem soft delete, sem
  "desfazer" pós-exclusão) — decisão explícita do usuário, ver ADR-001.
- Restringir a exclusão a um papel diferente de `operador` (ex.: exigir `gerente`) ou a
  um fluxo de aprovação por segundo usuário — avaliado e descartado, ver ADR-001.
- Enfileirar a exclusão de nota para sincronizar quando o aparelho estiver offline —
  decisão explícita, ver ADR-001.
- Ler QR code ou código de barras para preencher o campo de busca de nota por número de
  faturamento — permanece fora de escopo desde a ADR-005 de um PRD anterior; o atalho de
  bipagem rápida deste PRD não reabre essa decisão, ver ADR-002.
- Um botão de câmera individual por card da fila — o atalho de bipagem rápida é um único
  botão fora dos cards, não duplicado por nota, ver ADR-002.
- Lembrar a preferência de visibilidade de senha entre sessões, telas, ou entre os
  diferentes campos de senha de uma mesma tela.
- Qualquer mudança na política de senha em si (tamanho mínimo, regras de complexidade) —
  o escopo é só a visibilidade do que já foi digitado, a validação existente não muda.

## Architecture Decision Records

- [ADR-001: Exclusão definitiva de nota em conferência, com confirmação e sem exigência de progresso](adrs/adr-001.md) — hard delete de nota/itens/bipagens, papel `operador`, sem enfileiramento offline.
- [ADR-002: Atalho único de bipagem por câmera na fila, sem revisar a ADR-005 da busca de nota](adrs/adr-002.md) — botão único fora dos cards, escolhe a nota mais próxima da conclusão, reaproveita o algoritmo de alocação existente.
- [ADR-003: Card da fila ganha ações explícitas (ver produtos / excluir) no lugar do clique no card inteiro](adrs/adr-003.md) — dois controles independentes substituem o card inteiramente clicável.

## Open Questions

- Formato exato do erro exibido quando um operador tenta excluir uma nota que outro
  operador já excluiu (ou que já foi finalizada) em outro aparelho, entre o carregamento
  da fila e a confirmação da exclusão (US-001.EC-3, US-001.EC-4) — comportamento de erro
  específico fica a cargo do TechSpec.
- Comportamento exato de sincronização quando bipagens offline pendentes existem para
  uma nota que foi excluída por outro operador enquanto o aparelho estava offline — fica
  a cargo do TechSpec (ADR-001, seção Risks).
