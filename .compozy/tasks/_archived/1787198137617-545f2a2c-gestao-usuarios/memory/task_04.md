# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Tela `/usuarios` (admin): listagem com status, cadastro, edição, desativar/reativar e
reset de senha, mais o cliente HTTP dos cinco endpoints `/users`. Concluída e verificada
(UT-044..048 + E2E-001/002/003/005/006/007; suíte E2E inteira 16/16).

## Important Decisions

- A tela exibe a senha inicial (`CPF@DDMMAAAA`) no banner de sucesso do cadastro e do
  reset, com um `initialPasswordFor` próprio do frontend espelhando
  `domain/service/InitialPassword.ts`. Sem isso os fluxos 1 e 4 do PRD não fecham: a
  comunicação da credencial é manual e o admin não teria de onde lê-la. O valor não é
  enviado nem validado no cliente — quem define a senha continua sendo o backend.
- Perfil é um par de rádios em pílula (não um `<select>`): mantém o `DESIGN.md` e deixa
  UT-047 asseverar diretamente que só existem `operador` e `gerente`.
- Na edição, CPF e e-mail aparecem preenchidos e `disabled` em vez de ausentes — o admin
  precisa reconhecer de quem é a conta, e a regra de "não editável" fica visível.
- A linha do admin não oferece **nem** desativar **nem** editar: `UpdateUser` também
  responde `ForbiddenError` para alvo admin, então oferecer "Editar" ali seria um botão
  que sempre falha.
- Home do admin passou de `/historico` para `/usuarios` (o comentário da task_03 em
  `App.tsx` já antecipava isso).
- Rótulos das ações são curtos ("Editar", "Desativar", "Resetar senha") e os testes
  desambiguam por escopo (`within` da `listitem`, `getByRole("dialog")` para a
  confirmação) em vez de embutir o nome do usuário no botão.

## Learnings

- `Dialog` expõe `role="dialog"`, então `within(screen.getByRole("dialog"))` /
  `page.getByRole("dialog")` é o jeito de separar o botão de confirmação do botão
  homônimo da linha que o abriu.
- `page.getByLabel("Nova senha")` é substring por padrão no Playwright e casa também com
  "Confirme a nova senha": precisa de `{ exact: true }`.
- O `control-server` do e2e passou a semear também a conta `ADMIN`
  (`admin@loja.com`/`senha-admin`, CPF `98765432100`, nascimento `1975-11-05`).

## Files / Surfaces

- Novos: `features/users/{UsersScreen,UserFormDialog,initialPassword}.ts(x)` + os dois
  arquivos de teste; `e2e/specs/gestao-usuarios-e2e-{001-cadastro,002-desativacao,
  003-reset-senha,005-006-007-acesso}.spec.ts`.
- Alterados: `api/types.ts` (`AssignableRole`, `UserListItem`, `CreateUserInput`,
  `UpdateUserInput`), `api/client.ts` (helper `patch` + as seis funções de `/users`),
  `App.tsx` (rota `/usuarios` e home do admin), `test/fixtures.ts` (`buildUser`),
  `e2e/support/{control-server,fixtures}.ts` (conta ADMIN).

## Errors / Corrections

- Nenhuma correção de rumo. Única falha de execução: o `getByLabel` ambíguo do E2E-001,
  corrigido com `{ exact: true }`.

## Ready for Next Run

- Follow-up 1: em `/usuarios`, um operador/gerente recusado vê a mensagem genérica
  "Esta tela é exclusiva do papel gerente." — o texto do `RequireRole` só distingue
  operador/gerente. A task_04 tinha proibição explícita de alterar `RequireRole`, então
  ficou como está; corrigir junto de qualquer próxima mudança nesse componente.
- Follow-up 2: não há navegação persistente. O admin chega a `/usuarios` (sua home) mas
  só alcança bipagem e histórico por URL. O próprio PRD lista o cabeçalho de navegação
  como questão em aberto — é a peça que falta para a US-001 ficar confortável na prática.
