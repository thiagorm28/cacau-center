# User Stories: Melhorias na fila de notas e no login

Catálogo canônico de comportamento para: excluir nota em conferência, atalho de bipagem
por câmera na fila, reorganização do card da fila em ações explícitas, e botão de ver
senha no login e na troca de senha. Companion de `_prd.md`; consumido por `_techspec.md`
(mapeamento de componentes) e `_tests.md` (matriz de cobertura).

## Personas

- **Operador** — funcionário de loja que abre, bipa, finaliza e agora também exclui
  notas em conferência pela tela `/notas`. É quem mais usa a fila no dia a dia e quem
  mais se beneficia de um atalho para continuar bipando rápido.
- **Usuário do sistema** — qualquer pessoa com conta (`operador`, `gerente` ou `admin`)
  que precisa entrar no sistema ou trocar sua senha. O botão de ver senha atende a todos
  igualmente, sem distinção de papel.

## Story Index

| ID     | Feature Area              | Persona           | Story                                                          |
|--------|----------------------------|--------------------|-----------------------------------------------------------------|
| US-001 | Excluir nota               | Operador           | Excluir uma nota em conferência da fila                        |
| US-002 | Excluir nota               | Operador           | Ver o progresso que será perdido antes de confirmar a exclusão |
| US-003 | Excluir nota               | Operador           | Ser impedido de excluir nota sem conexão                       |
| US-004 | Fila de notas              | Operador           | Abrir uma nota pelo botão de ver produtos do card              |
| US-005 | Bipagem rápida             | Operador           | Começar a bipar direto da fila, sem escolher a nota manualmente |
| US-006 | Ver senha                  | Usuário do sistema | Ver a senha digitada no login antes de entrar                  |
| US-007 | Ver senha                  | Usuário do sistema | Ver a nova senha e a confirmação antes de salvar                |

## Excluir nota

### US-001: Excluir uma nota em conferência da fila

**As a** operador, **I want** excluir uma nota que está na fila de conferência, **so
that** eu consigo remover notas abertas por engano (número errado, duplicada) sem
deixá-las presas na fila para sempre.

Acceptance criteria:

- AC-1: Given uma nota com status `open` na fila, when o operador toca em "Excluir" no
  card da nota, then um diálogo de confirmação aparece antes de qualquer exclusão
  acontecer.
- AC-2: Given o diálogo de confirmação aberto, when o operador confirma a exclusão,
  then a nota, seus itens e todo o histórico de bipagens dela são removidos
  permanentemente, e a nota some da fila imediatamente.
- AC-3: Given o diálogo de confirmação aberto, when o operador cancela, then nada é
  excluído e a nota continua na fila como estava.
- AC-4: Given qualquer usuário autenticado com papel `operador`, when ele tenta excluir
  qualquer nota aberta (não só as que ele mesmo abriu), then a exclusão é permitida — não
  há restrição de "dono" da nota.

Edge cases:

- EC-1: Sessão expirada durante o diálogo de confirmação → a confirmação falha, o
  operador é levado para a tela de login (mesmo comportamento já existente para outras
  ações autenticadas), e a nota continua aberta.
- EC-2: Papel sem permissão (nenhum papel existe abaixo de `operador` hoje, mas a regra
  vale para qualquer usuário não autenticado) tenta excluir diretamente pela API → rejeitado
  com erro de permissão, nenhuma exclusão acontece.
- EC-3: Duas pessoas tentam excluir a mesma nota ao mesmo tempo (dois aparelhos) → a
  primeira exclusão vence; a segunda tentativa recebe um erro claro de "nota não
  encontrada" em vez de um erro genérico, porque a nota já não existe mais.
- EC-4: Exclusão de uma nota que já está com status `completed`/`closed_incomplete`
  (fechada) → não é possível: o botão de excluir só existe para notas `open`; a nota
  fechada não aparece na fila, então não tem como acionar a exclusão por essa tela.
- EC-5: Excluir a última nota aberta da fila → a fila passa a mostrar o estado de "fila
  vazia" que já existe hoje quando não há nenhuma nota em conferência.

## US-002: Ver o progresso que será perdido antes de confirmar a exclusão

**As a** operador, **I want** ver quantas caixas já foram bipadas na nota antes de
confirmar a exclusão, **so that** eu não apago sem perceber o trabalho de conferência já
feito.

Acceptance criteria:

- AC-1: Given uma nota sem nenhuma caixa bipada ainda (`confirmedTotal` igual a 0), when
  o diálogo de confirmação de exclusão abre, then o aviso não menciona perda de
  progresso, só confirma que a exclusão é permanente.
- AC-2: Given uma nota com pelo menos uma caixa já bipada (`confirmedTotal` maior que
  0), when o diálogo de confirmação de exclusão abre, then o aviso declara explicitamente
  quantas caixas já confirmadas serão perdidas (ex.: "Essa nota já tem 7 de 20 caixas
  conferidas. Excluir apaga esse progresso para sempre.").
- AC-3: Given qualquer nota, when o diálogo de confirmação abre, then o texto deixa
  claro que a ação não pode ser desfeita.

Edge cases:

- EC-1: Nota com todas as caixas já bipadas mas ainda não finalizada (`confirmedTotal`
  igual a `expectedTotal`, status ainda `open`) → o aviso trata como progresso máximo
  perdido, mesma regra do AC-2, sem tratamento especial por estar 100% bipada.

## US-003: Ser impedido de excluir nota sem conexão

**As a** operador, **I want** que a exclusão de nota só seja permitida com conexão,
**so that** eu não corro o risco de excluir uma nota de forma que gere conflito quando o
aparelho voltar a sincronizar.

Acceptance criteria:

- AC-1: Given o aparelho está offline, when o operador olha para o botão de excluir num
  card da fila, then o botão aparece desabilitado (ou com indicação equivalente de que a
  ação não está disponível agora).
- AC-2: Given o aparelho está offline, when o operador tenta acionar a exclusão mesmo
  assim (ex.: toque duplo antes do estado atualizar), then nenhuma exclusão é
  enfileirada — diferente de bipagem e finalização, exclusão nunca fica pendente
  aguardando conexão.
- AC-3: Given o aparelho estava offline e volta a ficar online, when a tela de fila
  atualiza, then o botão de excluir volta a ficar disponível normalmente.

Edge cases:

- EC-1: Conexão cai bem no meio do fluxo, entre o toque em "Excluir" e a confirmação no
  diálogo → a confirmação falha com uma mensagem de que é preciso conexão para excluir, e
  a nota permanece aberta e intacta.

## Fila de notas

### US-004: Abrir uma nota pelo botão de ver produtos do card

**As a** operador, **I want** um botão explícito no card da nota para ver os produtos
dela, **so that** eu consigo abrir uma nota especificamente, sem risco de confundir esse
toque com o de excluir.

Acceptance criteria:

- AC-1: Given a fila de notas carregada, when o operador toca no botão de ver produtos
  de um card, then a tela de bipagem daquela nota específica abre.
- AC-2: Given o mesmo card, when o operador toca no botão de excluir, then a tela de
  bipagem não abre — só o fluxo de exclusão (US-001) é acionado.
- AC-3: Given qualquer card da fila, when renderizado, then o botão de ver produtos e o
  botão de excluir são dois controles distintos e independentes — tocar fora de ambos
  (no restante do card) não dispara nenhuma ação.

Edge cases:

- EC-1: Card com uma nota que tem exatamente 1 item esperado → o botão de ver produtos
  funciona normalmente, mesmo comportamento de uma nota com muitos itens.
- EC-2: Toque muito próximo da borda entre os dois botões (mira imprecisa em mobile) →
  cada botão tem sua própria área de toque delimitada (segue o padrão mínimo de área de
  toque do DESIGN.md); um toque só aciona um dos dois, nunca os dois ao mesmo tempo.

## Bipagem rápida

### US-005: Começar a bipar direto da fila, sem escolher a nota manualmente

**As a** operador, **I want** um botão que abra a câmera de bipagem direto pela tela de
fila, **so that** eu consigo continuar conferindo caixas rapidamente sem precisar abrir
uma nota específica primeiro.

Acceptance criteria:

- AC-1: Given pelo menos uma nota aberta na fila, when o operador toca no botão de bipar
  da tela de fila (fora de qualquer card), then a tela de bipagem abre com a câmera ativa.
- AC-2: Given mais de uma nota aberta na fila, when o botão de bipar é tocado, then a
  tela de bipagem abre mostrando, no header, a nota com maior percentual de conclusão
  (`confirmedTotal / expectedTotal`) entre as abertas.
- AC-3: Given duas notas abertas empatadas no mesmo percentual de conclusão, when o
  botão de bipar é tocado, then a nota aberta há mais tempo (`openedAt` mais antigo) é a
  exibida — mesmo critério de desempate já usado pelo algoritmo de alocação de bipagem
  (`resolveScan`).
- AC-4: Given a tela de bipagem aberta pelo atalho, when o operador bipa uma caixa cujo
  código pertence a uma nota diferente da exibida no header, then a bipagem é creditada
  à nota correta (mesmo comportamento de alocação já existente, sem mudança), e a
  interface comunica a qual nota a bipagem foi creditada.
- AC-5: Given nenhuma nota aberta na fila, when o operador olha para o botão de bipar,
  then o botão aparece desabilitado (ou oculto) — não há para onde navegar.

Edge cases:

- EC-1: Única nota aberta já 100% bipada mas ainda não finalizada → o atalho ainda abre
  normalmente nela, mostrando o estado "nota completa" que a tela de bipagem já exibe
  hoje.
- EC-2: Aparelho offline com fila de notas vinda do retrato local (cache offline) → o
  atalho funciona da mesma forma usando as notas do retrato local, igual à entrada
  atual pela tela de bipagem de uma nota específica.
- EC-3: Todas as notas abertas têm `expectedTotal` igual a `confirmedTotal` (0/0, sem
  nenhum item esperado ainda) → tratado como percentual 0% para efeito da escolha da
  nota inicialmente exibida, sem divisão por zero.

## Ver senha

### US-006: Ver a senha digitada no login antes de entrar

**As a** usuário do sistema, **I want** um botão para mostrar a senha que estou
digitando no login, **so that** eu consigo conferir que digitei certo antes de tentar
entrar, especialmente em teclado de celular.

Acceptance criteria:

- AC-1: Given a tela de login, when o campo de senha está vazio ou preenchido, then um
  botão de alternar visibilidade (ícone de olho) aparece associado ao campo.
- AC-2: Given o campo de senha oculto (padrão), when o operador toca no botão, then a
  senha passa a ser exibida em texto plano no mesmo campo, e o ícone muda para indicar
  "ocultar".
- AC-3: Given o campo de senha visível, when o operador toca no botão novamente, then a
  senha volta a ficar oculta.
- AC-4: Given o botão de alternar visibilidade, when acionado, then o foco permanece no
  campo de senha (o operador pode continuar digitando sem precisar tocar no campo de
  novo).
- AC-5: Given um leitor de tela, when o foco chega no botão de alternar, then ele é
  anunciado com um rótulo acessível que descreve a ação ("Mostrar senha" /
  "Ocultar senha") e seu estado atual.

Edge cases:

- EC-1: Campo de senha vazio → o botão de alternar aparece normalmente, sem erro, mesmo
  sem nada digitado ainda.
- EC-2: Envio do formulário de login (Enter ou botão "Entrar") com a senha visível → o
  envio funciona normalmente, sem exigir que a senha volte a ficar oculta antes.
  Cache também: o comportamento de sessão expirada e mensagem de erro genérica
  (US-015.EC-1, já existente) não muda com o campo em modo texto visível.
  Visibilidade some depois de recarregar/reabrir a tela → o campo volta ao estado
  padrão oculto (não persiste entre sessões/telas).

### US-007: Ver a nova senha e a confirmação antes de salvar

**As a** usuário do sistema, **I want** um botão para mostrar a nova senha e a senha de
confirmação na tela de troca de senha, **so that** eu consigo confirmar que as duas
batem antes de salvar, sem depender só da validação de "as senhas não coincidem" depois
de errar.

Acceptance criteria:

- AC-1: Given a tela de troca de senha, when renderizada, then tanto o campo "Nova
  senha" quanto o campo "Confirme a nova senha" têm, cada um, seu próprio botão de
  alternar visibilidade.
- AC-2: Given os dois campos ocultos (padrão), when o operador alterna a visibilidade de
  um dos dois campos, then só aquele campo muda — o outro campo mantém seu próprio
  estado de visibilidade, independente.
- AC-3: Given os dois campos com visibilidade alternada para texto plano, when o
  operador compara os dois valores visualmente e salva, then o fluxo de validação
  existente (`PASSWORDS_DO_NOT_MATCH` se não baterem) continua funcionando normalmente,
  sem nenhuma mudança de comportamento além da visibilidade.

Edge cases:

- EC-1: "Nova senha" visível e "Confirme a nova senha" oculta ao mesmo tempo (estados
  divergentes entre os dois campos) → permitido, cada botão controla só o seu campo.
- EC-2: Erro de "as senhas não coincidem" exibido → o estado de visibilidade de cada
  campo não muda sozinho por causa do erro; o operador continua vendo (ou não vendo) o
  que já tinha escolhido antes de tentar salvar.
