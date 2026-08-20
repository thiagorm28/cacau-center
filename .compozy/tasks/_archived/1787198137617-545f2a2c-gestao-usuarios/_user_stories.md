# User Stories: Gestão de Usuários e Papel Admin

Catálogo canônico de comportamento para a feature de administração de usuários.
Complementa `_prd.md`; consumido por `_techspec.md` (mapeamento de componentes) e
`_tests.md` (matriz de cobertura).

## Personas

- **Admin** — o dono/responsável pela loja. Conta única no sistema, criada por script
  de bootstrap (ADR-001), nunca por outra tela. Enxerga e usa todas as telas do
  sistema sem restrição: bipagem/conferência (hoje exclusiva do operador),
  histórico/relatórios (hoje exclusivo do gerente) e a nova tela de gestão de
  usuários.
- **Operador** — funcionário de estoque que confere entregas. Papel existente,
  inalterado por esta feature exceto por ganhar um botão de logout visível.
- **Gerente** — dono/gerente da loja com acesso a histórico e relatórios. Papel
  existente, inalterado por esta feature exceto pelo botão de logout.
- **Novo usuário cadastrado** — operador ou gerente recém-criado pelo admin, que
  recebe verbalmente/por escrito suas credenciais iniciais (e-mail + senha
  `CPF@dataDeNascimento`) e precisa trocar a senha no primeiro acesso.

## Story Index

| ID     | Feature Area          | Persona              | Story                                                        |
|--------|------------------------|-----------------------|---------------------------------------------------------------|
| US-001 | Acesso do admin         | Admin                 | Logar e navegar por qualquer tela do sistema                  |
| US-002 | Logout                  | Todos os papéis       | Sair da conta pelo botão de logout                             |
| US-003 | Cadastro de usuário     | Admin                 | Cadastrar um novo operador/gerente                             |
| US-004 | Cadastro de usuário     | Admin                 | Ver validação ao cadastrar dados inválidos/duplicados          |
| US-005 | Listagem de usuários    | Admin                 | Ver a lista de usuários cadastrados                            |
| US-006 | Edição de usuário       | Admin                 | Editar nome, data de nascimento e perfil de um usuário         |
| US-007 | Desativação             | Admin                 | Desativar um usuário que saiu da loja                          |
| US-008 | Reativação              | Admin                 | Reativar um usuário desativado por engano                      |
| US-009 | Reset de senha          | Admin                 | Resetar a senha de um usuário que esqueceu a senha             |
| US-010 | Primeiro acesso         | Novo usuário          | Trocar a senha obrigatoriamente no primeiro login              |
| US-011 | Primeiro acesso         | Novo usuário          | Ser bloqueado de usar o sistema até concluir a troca de senha  |
| US-012 | Controle de acesso      | Operador/Gerente      | Não conseguir acessar a tela de gestão de usuários             |
| US-013 | Controle de acesso      | Admin                 | Não conseguir desativar a própria conta                        |

## Acesso do admin

### US-001: Logar e navegar por qualquer tela do sistema

**Como** admin, **quero** logar com minha conta e acessar qualquer tela do sistema
(bipagem, histórico/relatórios, gestão de usuários), **para que** eu tenha visibilidade
e controle total da loja sem depender de outro papel.

Acceptance criteria:

- AC-1: Dado que a conta admin existe (criada pelo bootstrap), quando faço login com
  e-mail e senha corretos, então entro no sistema como admin.
- AC-2: Dado que estou logado como admin, quando navego para a tela de bipagem,
  histórico/relatórios ou gestão de usuários, então cada uma carrega normalmente, sem
  bloqueio de papel.

Edge cases:

- EC-1: Sessão de admin expira → é levado à tela de login, igual a operador/gerente
  hoje (mesmo mecanismo de expiração já implementado).
- EC-2: Mais de uma aba/dispositivo logado como admin ao mesmo tempo → ambas
  funcionam normalmente; não há limite de sessões simultâneas (mesmo comportamento já
  válido para operador/gerente).

## Logout

### US-002: Sair da conta pelo botão de logout

**Como** usuário autenticado (qualquer papel), **quero** um botão de logout visível
nas telas do sistema, **para que** eu consiga encerrar minha sessão sem depender de
fechar o navegador ou esperar expirar.

Acceptance criteria:

- AC-1: Dado que estou autenticado, quando abro qualquer tela principal do sistema,
  então vejo um botão/ação de logout acessível.
- AC-2: Dado que clico no botão de logout, quando a ação completa, então sou levado à
  tela de login e minha sessão anterior deixa de funcionar (uma tentativa de navegar
  para uma rota protegida me devolve ao login).

Edge cases:

- EC-1: Clique em logout sem conexão de rede → a chamada falha silenciosamente e o
  cliente ainda limpa o estado local, levando à tela de login (mesmo comportamento já
  implementado em `SessionContext.signOut`, que ignora erro da chamada de rede).
- EC-2: Clique duplo/rápido no botão de logout → a segunda chamada não deve gerar
  erro visível ao usuário; o resultado final é a tela de login normalmente.

## Cadastro de usuário

### US-003: Cadastrar um novo operador/gerente

**Como** admin, **quero** cadastrar um novo usuário informando nome, data de
nascimento, CPF, e-mail e perfil (operador ou gerente), **para que** um novo
funcionário consiga logar no sistema com o papel correto.

Acceptance criteria:

- AC-1: Dado que preencho nome, data de nascimento, CPF, e-mail e escolho um perfil
  (operador ou gerente), quando confirmo o cadastro, então o usuário é criado com
  senha inicial `CPF@dataDeNascimento` (ex.: CPF `12345678900` e nascimento
  `15/03/1990` geram `12345678900@15031990`) e sinalizado para trocar a senha no
  primeiro login (ADR-002).
- AC-2: Dado que o cadastro foi concluído, quando volto à lista de usuários, então o
  novo usuário aparece nela como ativo.
- AC-3: Dado que estou na tela de cadastro, quando abro o seletor de perfil, então só
  vejo "operador" e "gerente" como opções — "admin" nunca aparece (ADR-001).

Edge cases:

- EC-1: Campo obrigatório vazio (nome, data de nascimento, CPF ou e-mail) → cadastro é
  bloqueado com mensagem indicando o campo faltante.
- EC-2: Nenhum perfil selecionado → cadastro é bloqueado até um perfil ser escolhido.

### US-004: Ver validação ao cadastrar dados inválidos/duplicados

**Como** admin, **quero** ser avisado quando o CPF ou e-mail informado for inválido ou
já pertencer a outro usuário, **para que** eu não crie cadastros duplicados ou
incorretos.

Acceptance criteria:

- AC-1: Dado que informo um CPF com formato/dígito verificador inválido, quando tento
  confirmar o cadastro, então vejo uma mensagem de erro e o cadastro não é criado.
- AC-2: Dado que informo um CPF ou e-mail que já pertence a outro usuário (ativo ou
  desativado), quando tento confirmar o cadastro, então vejo uma mensagem de erro
  específica e o cadastro não é criado.
- AC-3: Dado que informo um e-mail em formato inválido, quando tento confirmar,
  então vejo uma mensagem de erro e o cadastro não é criado.

Edge cases:

- EC-1: CPF com todos os dígitos iguais (ex.: `11111111111`, matematicamente "válido"
  no algoritmo de dígito verificador mas conhecido como inválido na prática) → tratado
  como inválido.
- EC-2: Dois cadastros simultâneos com o mesmo CPF/e-mail (dois admins, ou duplo clique)
  → apenas um é aceito; o segundo recebe o erro de duplicidade (US-004.AC-2).

## Listagem de usuários

### US-005: Ver a lista de usuários cadastrados

**Como** admin, **quero** ver a lista de todos os usuários cadastrados com nome,
perfil e status (ativo/desativado), **para que** eu tenha visão geral de quem tem
acesso ao sistema.

Acceptance criteria:

- AC-1: Dado que existem usuários cadastrados, quando abro a tela de gestão de
  usuários, então vejo cada um com nome, perfil e status.
- AC-2: Dado que existem usuários ativos e desativados, quando vejo a lista, então
  consigo diferenciar visualmente os dois estados.

Edge cases:

- EC-1: Nenhum usuário cadastrado além do próprio admin → a lista mostra apenas o
  admin (ou uma mensagem de lista vazia, se o admin não aparecer na listagem de
  operador/gerente).
- EC-2: Grande número de usuários cadastrados → a lista permanece navegável (paginação
  ou rolagem, detalhe de TechSpec), sem travar a tela.

## Edição de usuário

### US-006: Editar nome, data de nascimento e perfil de um usuário

**Como** admin, **quero** editar o nome, a data de nascimento e o perfil de um usuário
existente, **para que** eu consiga corrigir dados incorretos ou promover/rebaixar
alguém de papel.

Acceptance criteria:

- AC-1: Dado que abro a edição de um usuário existente, quando altero nome, data de
  nascimento ou perfil e salvo, então a mudança é refletida imediatamente na listagem.
- AC-2: Dado que altero o perfil de um usuário de operador para gerente (ou
  vice-versa), quando ele fizer login novamente, então seu acesso reflete o novo
  perfil.

Edge cases:

- EC-1: Tentativa de editar o perfil para "admin" → opção não disponível (mesma regra
  do cadastro, US-003.AC-3).
- EC-2: Edição de CPF/e-mail para um valor já usado por outro usuário → bloqueado com
  a mesma validação de duplicidade de US-004.AC-2.
- EC-3: Usuário está com sessão ativa no momento da edição do próprio perfil → a
  sessão já aberta continua com o papel antigo até expirar ou até o próximo login
  (mesmo comportamento de qualquer alteração de papel: o token carrega o papel no
  momento da emissão).

## Desativação

### US-007: Desativar um usuário que saiu da loja

**Como** admin, **quero** desativar o acesso de um usuário que não trabalha mais na
loja, **para que** ele não consiga mais logar, sem perder o histórico de notas e
bipagens já registrado por ele (ADR-003).

Acceptance criteria:

- AC-1: Dado que seleciono "desativar" para um usuário ativo, quando confirmo, então
  o status dele muda para desativado na listagem.
- AC-2: Dado que um usuário foi desativado, quando ele tenta logar (mesmo com senha
  correta), então o login é recusado.
- AC-3: Dado que um usuário desativado tinha notas/bipagens registradas antes da
  desativação, quando consulto o histórico/relatório dessas notas, então o nome dele
  continua aparecendo normalmente como quem abriu/bipou.

Edge cases:

- EC-1: Usuário desativado tinha uma sessão já aberta (JWT válido) no momento da
  desativação → o acesso é cortado (comportamento exato de invalidação é decisão de
  TechSpec, mas o requisito de produto é: não continuar acessível até o token expirar
  sozinho).
- EC-2: Tentativa de desativar o próprio admin → bloqueada (US-013).

## Reativação

### US-008: Reativar um usuário desativado por engano

**Como** admin, **quero** reativar um usuário que eu desativei por engano (ou que
voltou a trabalhar na loja), **para que** ele volte a conseguir logar sem precisar de
um cadastro novo.

Acceptance criteria:

- AC-1: Dado que seleciono "reativar" para um usuário desativado, quando confirmo,
  então o status dele volta a ativo na listagem.
- AC-2: Dado que um usuário foi reativado, quando ele faz login com a senha que tinha
  antes da desativação, então o login funciona normalmente (a senha não é resetada só
  por reativar).

Edge cases:

- EC-1: Reativação de um usuário cujo CPF/e-mail foi reaproveitado por outro cadastro
  enquanto estava desativado → bloqueada pela mesma validação de duplicidade
  (US-004.AC-2), já que o CPF/e-mail original ainda pertence à conta desativada.

## Reset de senha

### US-009: Resetar a senha de um usuário que esqueceu a senha

**Como** admin, **quero** resetar a senha de um usuário para o padrão inicial,
**para que** alguém que esqueceu a senha consiga voltar a acessar o sistema sem
precisar de um cadastro novo.

Acceptance criteria:

- AC-1: Dado que seleciono "resetar senha" para um usuário existente, quando
  confirmo, então a senha dele volta a ser `CPF@dataDeNascimento` e a conta é
  sinalizada para trocar a senha no próximo login (mesma regra de US-010/US-011).
- AC-2: Dado que resetei a senha de alguém, quando essa pessoa faz login com a senha
  antiga (anterior ao reset), então o login é recusado.

Edge cases:

- EC-1: Reset de senha para um usuário desativado → bloqueado (não faz sentido
  resetar senha de quem não pode logar; admin precisa reativar primeiro).
- EC-2: Dois resets em sequência rápida para o mesmo usuário → resultado final é
  idempotente (senha volta ao padrão, flag de troca obrigatória fica marcada).

## Primeiro acesso

### US-010: Trocar a senha obrigatoriamente no primeiro login

**Como** novo usuário cadastrado (ou usuário que teve a senha resetada), **quero** ser
guiado a escolher uma nova senha assim que eu logar pela primeira vez com a senha
inicial, **para que** minha conta pare de depender de uma senha adivinhável a partir
do meu CPF e data de nascimento.

Acceptance criteria:

- AC-1: Dado que faço login com a senha inicial `CPF@dataDeNascimento` pela primeira
  vez, quando o login é aceito, então sou direcionado a uma tela de definição de nova
  senha antes de qualquer outra tela.
- AC-2: Dado que estou na tela de definição de nova senha, quando informo e confirmo
  uma nova senha válida, então minha senha é atualizada e passo a acessar o sistema
  normalmente.

Edge cases:

- EC-1: Nova senha informada é idêntica à senha inicial (`CPF@dataDeNascimento`) →
  recusada, com mensagem pedindo uma senha diferente da inicial.
- EC-2: As duas confirmações de nova senha não coincidem → bloqueado até coincidirem.

### US-011: Ser bloqueado de usar o sistema até concluir a troca de senha

**Como** sistema, **quero** impedir qualquer ação além da troca de senha enquanto ela
estiver pendente, **para que** a obrigatoriedade da troca (ADR-002) não seja
contornável.

Acceptance criteria:

- AC-1: Dado que tenho uma troca de senha pendente, quando tento navegar diretamente
  para qualquer outra rota (bipagem, histórico, gestão de usuários), então sou
  redirecionado de volta para a tela de troca de senha.
- AC-2: Dado que concluí a troca de senha, quando navego pelo sistema depois, então
  não sou mais redirecionado para essa tela.

Edge cases:

- EC-1: Usuário fecha o app com a troca pendente e volta depois → ao logar de novo,
  ainda é levado à tela de troca de senha (o estado pendente persiste no servidor, não
  no cliente).

## Controle de acesso

### US-012: Não conseguir acessar a tela de gestão de usuários

**Como** operador ou gerente, **quero** que a tela de gestão de usuários não fique
disponível para mim, **para que** fique claro que só o admin administra contas do
sistema.

Acceptance criteria:

- AC-1: Dado que estou logado como operador ou gerente, quando tento acessar a rota
  da tela de gestão de usuários (por navegação direta de URL, não só pela ausência de
  link), então recebo acesso negado e não vejo dados de outros usuários.
- AC-2: Dado que estou logado como operador ou gerente, quando vejo a navegação do
  sistema, então não existe nenhum link/botão para a tela de gestão de usuários.

Edge cases:

- EC-1: Sessão de operador/gerente com token adulterado tentando reivindicar papel
  admin → recusado pelo mesmo mecanismo de verificação de papel já usado pelas rotas
  existentes (`RoleGuard`).

### US-013: Não conseguir desativar a própria conta

**Como** sistema, **quero** impedir que a única conta admin se autodesative,
**para que** a loja nunca fique sem nenhum admin ativo capaz de gerenciar usuários.

Acceptance criteria:

- AC-1: Dado que estou logado como admin e abro minha própria linha na listagem de
  usuários, quando procuro a ação de desativar, então ela não está disponível para a
  própria conta (ou, se disponível, é recusada com uma mensagem explicando o motivo).

Edge cases:

- EC-1: Tentativa de desativar a própria conta via chamada direta à API (contornando a
  UI) → recusada pelo backend do mesmo jeito, não só escondida na interface.
