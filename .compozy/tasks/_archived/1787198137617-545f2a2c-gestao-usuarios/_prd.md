# PRD: Gestão de Usuários e Papel Admin

## Overview

Hoje o sistema de conferência de notas fiscais tem dois papéis (`operador`,
`gerente`), mas nenhuma forma de criar, editar ou desativar contas dentro do próprio
produto — usuários são inseridos manualmente, e não existe ninguém com visão e
controle total sobre a loja. Isso é um problema tanto operacional (o dono da loja
depende de intervenção técnica direta no banco para dar acesso a um novo funcionário)
quanto de segurança (não há como remover o acesso de quem sai da loja, nem visão de
quem tem conta hoje).

Este produto introduz um papel `admin` — único, pertencente ao dono/responsável pela
loja — com acesso irrestrito a todas as telas do sistema, incluindo uma nova tela de
gestão de usuários onde o admin cadastra, edita, desativa e reativa contas de
`operador` e `gerente`, e reseta senhas esquecidas. Também adiciona um botão de logout
visível, hoje ausente da interface apesar de o mecanismo já existir no backend.

## Goals

- O dono/responsável da loja consegue logar como admin e acessar qualquer tela do
  sistema (bipagem, histórico/relatórios, gestão de usuários) sem depender de outro
  papel.
- O admin consegue dar acesso a um novo funcionário (operador ou gerente) sem
  intervenção técnica no banco de dados.
- O admin consegue ver, de relance, todos os usuários cadastrados e o status
  (ativo/desativado) de cada um.
- O admin consegue remover o acesso de um funcionário que saiu da loja sem apagar o
  histórico de notas e bipagens que ele registrou.
- Um usuário recém-cadastrado nunca continua acessando o sistema apenas com uma senha
  derivada de dados públicos (CPF e data de nascimento) — a primeira ação obrigatória
  é trocar essa senha.
- Qualquer usuário autenticado consegue encerrar a própria sessão por um botão visível,
  sem depender de fechar o navegador.
- Só existe uma conta admin durante toda a vida do sistema, e ela nunca pode ficar sem
  acesso (não é possível autodesativar a única conta admin).

## User Stories

Catálogo completo em [_user_stories.md](_user_stories.md). Faixas por área:

- **Acesso do admin** (US-001) — login e navegação irrestrita por todas as telas.
- **Logout** (US-002) — botão de logout visível para qualquer papel autenticado.
- **Cadastro de usuário** (US-003 e US-004) — criação de operador/gerente com
  validação de dados obrigatórios, formato e duplicidade.
- **Listagem de usuários** (US-005) — visão geral de todos os usuários e seus status.
- **Edição de usuário** (US-006) — correção de nome, data de nascimento e perfil.
- **Desativação e reativação** (US-007 e US-008) — remoção e restauração de acesso
  preservando o histórico existente.
- **Reset de senha** (US-009) — recuperação de acesso para quem esqueceu a senha.
- **Primeiro acesso** (US-010 e US-011) — troca de senha obrigatória e bloqueio de
  qualquer outra ação até ela ser concluída.
- **Controle de acesso** (US-012 e US-013) — a tela de gestão de usuários é exclusiva
  do admin, e a própria conta admin não pode se autodesativar.

## Core Features

### 1. Papel admin

Um novo papel, `admin`, com acesso irrestrito a todas as telas do sistema — as
operacionais (bipagem, hoje exclusivas do operador) e as gerenciais (histórico e
relatórios, hoje exclusivas do gerente), além da nova tela de gestão de usuários. Só
existe uma conta admin, criada uma única vez por um processo de implantação (fora da
aplicação — ver ADR-001), nunca por uma tela ou rota do produto. O papel `admin` nunca
aparece como opção selecionável em nenhum formulário de cadastro/edição de usuário.

### 2. Botão de logout

Um botão/ação de logout visível em qualquer tela principal, disponível para os três
papéis (admin, operador, gerente). Encerra a sessão atual e leva à tela de login; uma
tentativa de acessar qualquer rota protegida depois disso é recusada como se a sessão
nunca tivesse existido.

### 3. Gestão de usuários (exclusiva do admin)

Uma tela nova, acessível apenas pelo admin, com:

- **Listagem**: todos os usuários cadastrados, com nome, perfil (operador/gerente) e
  status (ativo/desativado).
- **Cadastro**: formulário com nome, data de nascimento, CPF, e-mail e escolha de
  perfil (operador ou gerente — nunca admin). Ao confirmar, o sistema cria a conta com
  a senha inicial descrita na seção Business Rules e marca a troca de senha como
  obrigatória no primeiro login.
- **Edição**: alteração de nome, data de nascimento e perfil de um usuário existente.
- **Desativação/reativação**: remove ou restaura o acesso de login de um usuário sem
  apagar seu histórico de notas/bipagens já registrado (ver ADR-003).
- **Reset de senha**: devolve a conta de um usuário à senha inicial
  (`CPF@dataDeNascimento`) e marca a troca como obrigatória de novo — usado quando
  alguém esquece a senha.

### 4. Primeiro acesso com troca de senha obrigatória

Sempre que uma conta está com a senha inicial pendente (recém-cadastrada ou recém
resetada pelo admin), o primeiro login bem-sucedido leva direto a uma tela de definição
de nova senha, bloqueando qualquer outra tela até essa troca ser concluída (ver
ADR-002).

## Business Rules

- **Identificador de login**: continua sendo o e-mail, sem mudanças no mecanismo de
  autenticação existente (ver ADR-004). CPF é um dado cadastral, não um identificador
  de autenticação.
- **CPF**: campo obrigatório e único por usuário. Um cadastro/edição com CPF já
  usado por outro usuário (ativo ou desativado) é recusado.
- **E-mail**: campo obrigatório e único por usuário (regra já existente, mantida sem
  mudanças).
- **Senha inicial**: `CPF@dataDeNascimento`, sem pontuação no CPF e no formato
  `DDMMAAAA` para a data (ex.: CPF `12345678900` e nascimento `15/03/1990` →
  `12345678900@15031990`). Válida apenas até o primeiro login bem-sucedido.
- **Troca de senha obrigatória**: toda conta recém-criada ou que teve a senha
  resetada pelo admin fica marcada como "troca pendente". Enquanto pendente, nenhuma
  rota além da própria troca de senha é acessível para aquele usuário. A nova senha
  não pode ser igual à senha inicial.
- **Seleção de perfil**: as telas de cadastro e edição de usuário só oferecem
  `operador` e `gerente` como opções. `admin` nunca é selecionável — a conta admin é
  única e não nasce dessas telas (ADR-001).
- **Desativação**: é lógica, nunca exclusão da linha do usuário (ADR-003). Um usuário
  desativado não consegue logar, mesmo com a senha correta; uma sessão já aberta no
  momento da desativação perde o acesso. O histórico de notas e bipagens já registrado
  por um usuário desativado continua íntegro e atribuído ao nome dele.
- **Reativação**: restaura o login sem alterar a senha atual (reativar não é o mesmo
  que resetar senha).
- **A única conta admin nunca pode ser desativada**, nem pela UI nem por chamada
  direta à API — é a única forma de garantir que a loja sempre tenha alguém capaz de
  gerenciar usuários.
- **Visibilidade por papel**: a tela de gestão de usuários só é acessível pelo admin;
  operador e gerente recebem acesso negado ao tentar acessá-la diretamente, e não veem
  nenhum link para ela na navegação.

## User Experience

### Personas

- **Admin** — dono/responsável pela loja, único titular do papel. Precisa de
  visibilidade e controle totais sem depender de suporte técnico para dar ou remover
  acesso de funcionários.
- **Operador** — funcionário de estoque, papel existente. Ganha apenas o botão de
  logout; nenhuma outra mudança de fluxo.
- **Gerente** — dono/gerente da loja com acesso a histórico e relatórios, papel
  existente. Ganha apenas o botão de logout.
- **Novo usuário cadastrado** — operador ou gerente recém-criado, que recebe suas
  credenciais iniciais verbalmente/por escrito do admin (não há envio automático por
  e-mail nesta versão) e é guiado a trocar a senha no primeiro acesso.

### Fluxos principais

1. **Cadastrar um funcionário novo**: admin abre a tela de gestão de usuários → toca
   em cadastrar → preenche nome, data de nascimento, CPF, e-mail, escolhe o perfil →
   confirma → comunica ao funcionário o e-mail e a senha inicial
   (`CPF@dataDeNascimento`) pessoalmente.
2. **Primeiro acesso do funcionário**: funcionário loga com e-mail e a senha inicial →
   é levado direto à tela de troca de senha → define uma nova senha → passa a acessar
   normalmente as telas do seu perfil.
3. **Funcionário sai da loja**: admin abre a gestão de usuários → localiza o usuário →
   desativa → o funcionário não consegue mais logar, mas seu histórico de conferências
   permanece visível nos relatórios.
4. **Funcionário esquece a senha**: admin abre a gestão de usuários → localiza o
   usuário → reseta a senha → comunica a nova senha inicial → funcionário passa pelo
   mesmo fluxo de troca obrigatória do primeiro acesso.
5. **Encerrar sessão**: qualquer usuário autenticado toca no botão de logout, visível
   em qualquer tela principal → volta à tela de login.

### Considerações de UI/UX

- Toda a interface desta feature segue `DESIGN.md` (paleta chocolate/creme, cantos
  arredondados, tipografia Caprasimo/Figtree) — mesmo padrão visual já usado em
  `LoginScreen` e `Screen`.
- O botão de logout precisa de um lugar consistente entre todas as telas autenticadas
  (hoje não existe cabeçalho/navegação persistente além do topo específico de cada
  `Screen`) — o desenho exato desse componente de navegação é decisão de
  implementação, mas o requisito de produto é: visível e alcançável de qualquer tela
  principal, para qualquer papel.
- A tela de gestão de usuários é mobile-first, como o restante do produto (PWA usado
  em loja física).

## High-Level Technical Constraints

- Login, sessão (cookie JWT) e rate limiting de tentativas de login continuam usando
  e-mail como identificador — nenhuma mudança nesse mecanismo já implementado
  (ADR-004).
- CPF é dado pessoal comum sob a LGPD (não sensível), mas ainda assim exige tratamento
  cuidadoso: transporte sob HTTPS (já garantido pela infraestrutura atual), sem
  exposição desnecessária em logs.
- A desativação de usuário precisa cortar o acesso de sessões já emitidas, não apenas
  impedir novos logins — o mecanismo exato (checagem em cada request vs. revogação de
  token) fica para o TechSpec.
- O histórico de notas e bipagens (`invoiceNotes.openedBy`, `scanEvents.scannedBy`)
  referencia a linha do usuário — qualquer implementação de remoção de acesso precisa
  preservar essas referências (ADR-003).
- A criação da conta admin acontece fora do ciclo normal de request/resposta da
  aplicação (script de implantação), não por uma rota de API pública (ADR-001).

## Non-Goals (Out of Scope)

- **Migração de deploy para a Vercel**: pedido explicitamente separado desta PRD pelo
  usuário por ser uma decisão de infraestrutura sem personas/fluxos de produto — vira
  uma iniciativa própria, focada em TechSpec.
- **Login por CPF**: descartado durante o brainstorming; login continua por e-mail
  (ADR-004). CPF é só um dado cadastral.
- **Múltiplos admins**: o sistema suporta exatamente um admin; criar uma segunda conta
  admin pela aplicação não é suportado.
- **Recuperação de senha self-service** (ex.: "esqueci minha senha" com envio de
  e-mail): reset de senha é sempre mediado pelo admin (US-009), não um fluxo público.
- **Envio automático de credenciais por e-mail/SMS**: a comunicação da senha inicial ao
  funcionário é manual (verbal/escrita), fora do sistema.
- **Exclusão definitiva de usuários**: remoção de acesso é sempre desativação lógica,
  nunca exclusão da linha (ADR-003).
- **Auditoria/log de quem alterou o quê na gestão de usuários**: não foi pedido; pode
  virar uma iniciativa futura se necessário.

## Architecture Decision Records

- [ADR-001: Papel admin único, provisionado fora da aplicação](adrs/adr-001.md)
- [ADR-002: Senha inicial previsível com troca obrigatória no primeiro login](adrs/adr-002.md)
- [ADR-003: Desativação em vez de exclusão de usuários](adrs/adr-003.md)
- [ADR-004: Login continua por e-mail; CPF é dado de cadastro, não identificador de autenticação](adrs/adr-004.md)

## Open Questions

- Formato exato de validação do CPF (uso de dígito verificador completo vs. apenas
  formato) — fica para o TechSpec definir a biblioteca/algoritmo.
- Regras de força da nova senha escolhida no primeiro acesso (tamanho mínimo,
  complexidade) — não especificadas pelo usuário; TechSpec propõe um padrão razoável.
- Desenho visual exato do botão/menu de logout e de um eventual cabeçalho de navegação
  persistente (hoje inexistente) — decisão de implementação dentro das regras do
  DESIGN.md.
