# User Stories: Retractable Side Navigation Drawer

Canonical behavior catalog for the retractable side navigation drawer. Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

## Personas

- **Operador** — scans/processes invoices (fila de notas, bipagem, relatório). Today reaches only their own feature area; needs a consistent, findable way to log out from any screen in that flow.
- **Gerente** — reviews invoice history (`/historico`). A single-feature role, same logout-consistency need as Operador.
- **Admin** — manages users (`/usuarios`) and, per existing role rules, can reach every route in the app. The only persona for whom the drawer's navigation list has more than one real destination.

## Story Index

| ID     | Feature Area                     | Persona            | Story                                                        |
|--------|-----------------------------------|---------------------|---------------------------------------------------------------|
| US-001 | Abertura e fechamento             | Todos               | Abrir a aba lateral a partir de qualquer tela permitida       |
| US-002 | Abertura e fechamento             | Todos               | Fechar a aba lateral sem navegar                              |
| US-003 | Navegação entre funcionalidades   | Todos               | Navegar para outra funcionalidade pela aba, por papel         |
| US-004 | Identidade do usuário             | Todos               | Ver nome e papel do usuário logado na aba                     |
| US-005 | Logout consolidado                | Todos               | Sair da conta pelo botão de logout dentro da aba              |
| US-006 | Restrição durante fluxo obrigatório | Todos             | Aba não aparece durante a troca de senha obrigatória          |

## Abertura e fechamento

### US-001: Abrir a aba lateral a partir de qualquer tela permitida

**As a** usuário autenticado (qualquer papel), **I want** abrir a aba lateral de navegação a partir de um botão sempre presente, **so that** eu consiga navegar ou sair da conta de onde quer que eu esteja no app.

Acceptance criteria:

- AC-1: Given usuário autenticado em uma tela permitida (qualquer uma exceto a de troca de senha obrigatória), when toca no botão de abrir a aba, then a aba desliza a partir da lateral esquerda com um fundo escurecido sobre a tela atual.
- AC-2: Given a aba já está aberta, when o usuário aciona a abertura novamente, then a aba permanece aberta sem duplicar ou piscar.

Edge cases:

- EC-1: Usuário não autenticado (tela de login) → botão de abrir a aba não existe na tela.
- EC-2: Usuário na tela de troca de senha obrigatória → botão de abrir a aba não aparece (ver US-006).
- EC-3: Toque duplo rápido no botão de abrir → aba abre uma única vez, sem estados intermediários quebrados.
- EC-4: Conexão perdida enquanto a aba está aberta → aba continua funcional (abrir/fechar/navegar dentro do já carregado), pois não depende de rede para existir.
- EC-5: Sessão expira enquanto a aba está aberta → ao tentar navegar ou interagir, aplica-se o comportamento padrão de sessão expirada do app (redirecionamento ao login); a aba não trava a tela.

### US-002: Fechar a aba lateral sem navegar

**As a** usuário autenticado, **I want** fechar a aba lateral sem precisar escolher um destino, **so that** eu consiga cancelar a navegação e continuar de onde estava.

Acceptance criteria:

- AC-1: Given a aba está aberta, when o usuário toca na área escurecida fora da aba, then a aba fecha e a rota atual permanece inalterada.
- AC-2: Given a aba está aberta, when o usuário desliza (swipe) a aba de volta para fora da tela, then a aba fecha e a rota atual permanece inalterada.

Edge cases:

- EC-1: Usuário aciona o gesto/botão de voltar do sistema com a aba aberta → a aba fecha corretamente, sem deixar a tela em estado inconsistente.
- EC-2: App perde foco (troca de aplicativo) com a aba aberta e o usuário retorna → a aba permanece no mesmo estado (aberta) em que estava antes da troca de foco.
- EC-3: Usuário fecha a aba repetidamente sem nunca navegar por ela → nenhum efeito colateral se acumula; cada fechamento é limpo e idêntico.

## Navegação entre funcionalidades

### US-003: Navegar para outra funcionalidade pela aba, por papel

**As a** usuário autenticado, **I want** ver na aba somente as funcionalidades principais que meu papel permite acessar, **so that** eu consiga ir direto para outra área do app sem tentar destinos que não tenho permissão de usar.

Acceptance criteria:

- AC-1: Given usuário com papel operador, when abre a aba, then vê somente "Fila de notas" na lista de navegação.
- AC-2: Given usuário com papel gerente, when abre a aba, then vê somente "Histórico" na lista de navegação.
- AC-3: Given usuário com papel admin, when abre a aba, then vê "Fila de notas", "Histórico" e "Gestão de usuários" na lista de navegação.
- AC-4: Given a aba está aberta, when o usuário toca em um item da lista diferente da tela atual, then é navegado para a tela dessa funcionalidade e a aba fecha automaticamente.
- AC-5: Given a tela atual corresponde a um item da lista de navegação, then esse item aparece visualmente destacado como o item ativo.

Edge cases:

- EC-1: Usuário está em uma tela de sub-fluxo de uma funcionalidade (ex.: bipagem ou relatório de uma nota específica) → o item da funcionalidade-mãe ("Fila de notas") aparece destacado como ativo; bipagem e relatório não têm item próprio na lista.
- EC-2: Usuário toca no item já destacado como ativo (a própria tela atual) → a aba apenas fecha, sem navegação ou recarregamento da tela.
- EC-3: Usuário tenta acessar por URL direta uma tela fora do que seu papel permite → o bloqueio de acesso já existente no app continua valendo; a aba não concede acesso novo, apenas reflete o que o papel já permite.
- EC-4: Papel do usuário for um valor sem nenhuma funcionalidade mapeada → a lista de navegação aparece vazia, mas a identidade do usuário (US-004) e o logout (US-005) continuam visíveis na aba.

## Identidade do usuário

### US-004: Ver nome e papel do usuário logado na aba

**As a** usuário autenticado, **I want** ver meu nome e meu papel no topo da aba, **so that** eu confirme rapidamente qual conta está logada no dispositivo, especialmente em um app usado por várias pessoas com papéis diferentes no mesmo aparelho.

Acceptance criteria:

- AC-1: Given a aba está aberta, then o nome do usuário logado é exibido no topo da aba.
- AC-2: Given a aba está aberta, then o papel do usuário (operador, gerente ou admin) é exibido junto ao nome, em texto legível para o usuário final (não o valor técnico bruto).

Edge cases:

- EC-1: Nome do usuário ausente ou vazio nos dados da sessão → a aba exibe um identificador alternativo disponível (ex.: usuário/e-mail) em vez de deixar o espaço em branco sem explicação.
- EC-2: Nome do usuário muito longo para o espaço disponível → o texto é truncado (ex.: reticências) sem quebrar o layout da aba.

## Logout consolidado

### US-005: Sair da conta pelo botão de logout dentro da aba

**As a** usuário autenticado, **I want** encontrar o botão de logout sempre no mesmo lugar dentro da aba lateral, **so that** eu consiga sair da conta de forma previsível de qualquer tela, sem depender de cada tela ter seu próprio botão.

Acceptance criteria:

- AC-1: Given a aba está aberta, when o usuário toca no botão de logout no rodapé da aba, then a sessão é encerrada e o usuário é redirecionado para a tela de login.
- AC-2: Given o usuário fez logout, when tenta retornar a uma tela autenticada (ex.: pelo botão voltar), then não consegue acessá-la sem autenticar novamente.

Edge cases:

- EC-1: Usuário toca no botão de logout duas vezes rapidamente → apenas um logout é processado; a segunda interação não gera erro nem estado inconsistente.
- EC-2: Conexão é perdida no momento do toque em logout → a sessão local é encerrada com a mesma garantia que o mecanismo de logout atual do app já oferece (nenhuma mudança de comportamento nessa dimensão).
- EC-3: Usuário faz logout no meio de um sub-fluxo com estado não salvo (ex.: bipagem em andamento) → a sessão encerra normalmente; qualquer estado não salvo se perde, igual ao comportamento já existente do logout hoje.
- EC-4: Usuário está na tela de troca de senha obrigatória, onde a aba lateral não aparece (US-006) → um botão de logout próprio dessa tela continua disponível (única exceção à consolidação), garantindo que o usuário nunca fique sem forma de sair da conta.

## Restrição durante fluxo obrigatório

### US-006: Aba não aparece durante a troca de senha obrigatória

**As a** usuário que precisa trocar a senha obrigatoriamente antes de continuar, **I want** não ter uma forma de escapar dessa etapa pela aba lateral, **so that** eu conclua a troca de senha antes de acessar qualquer outra funcionalidade, mantendo a regra de negócio já existente.

Acceptance criteria:

- AC-1: Given o usuário está na tela de troca de senha obrigatória, then o botão de abrir a aba lateral não é exibido.
- AC-2: Given o usuário concluiu a troca de senha obrigatória e é redirecionado para sua tela inicial, then o botão de abrir a aba volta a aparecer normalmente.

Edge cases:

- EC-1: Usuário tenta acessar por URL direta a tela de outra funcionalidade enquanto a troca de senha ainda é obrigatória → o redirecionamento forçado já existente continua sendo aplicado, independentemente da aba lateral existir ou não.
