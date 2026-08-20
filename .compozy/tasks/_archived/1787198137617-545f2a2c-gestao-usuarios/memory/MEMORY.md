# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 concluída: schema, `Cpf`, `SessionRevocationStore`, guards (`RoleGuard` com
  bypass de admin, `PasswordChangeGuard` global), `Login` recusando conta desativada e
  `scripts/bootstrap-admin.ts` estão de pé e verificados.
- task_02 concluída: os 7 usecases de usuário, `UserController` (admin-only),
  `POST /auth/change-password` e as fixtures `USER_PENDING_CHANGE`/`USER_DEACTIVATED`
  do `TestApp` estão de pé e verificados. O backend está pronto para o frontend.
- task_03 concluída: `UserRole`/`SessionUser` do frontend widened, `changePassword` no
  cliente, bypass de admin no `RequireRole`, `RequirePasswordChange` envolvendo as rotas,
  `ChangePasswordScreen` em `/trocar-senha` e botão "Sair" no `header` de toda tela
  autenticada.
- task_04 concluída: `features/users/` (`UsersScreen`, `UserFormDialog`), o cliente HTTP
  de `/users`, a rota `/usuarios` (home do admin) e os E2E de gestão de usuários estão de
  pé e verificados. A feature está completa: as quatro tasks fecharam.

## Shared Decisions

- `PasswordChangeGuard` é global e barra **tudo** que não tiver
  `@AllowPendingPasswordChange()`. Toda rota nova acessível com troca de senha pendente
  (hoje: `/auth/logout`, `/auth/me`, e a futura `/auth/change-password`) precisa do
  decorator explicitamente.
- Logout continua sem revogar sessão no servidor (só limpa o cookie). Revogar no logout
  não é viável com o `SessionRevocationStore` por usuário: `iat` tem resolução de
  segundo, então um relogin imediato seria recusado.
- `Role`/`SessionUser` do backend agora carregam `admin` e `mustChangePassword`; o
  frontend (`UserRole`, `SessionUser`) ainda precisa do mesmo widening (task_03).
- Erro de validação de DTO agora responde **422** em toda a API, não 400: o
  `ValidationPipe` global de `bootstrap.ts` usa `errorHttpStatusCode: 422`. Foi a única
  forma de atender à tabela de endpoints (pipes globais rodam antes dos de controller no
  Nest), e alinha a validação de campo com o 422 que o `ErrorFilter` já dá a `Error`
  puro. O IT-028 de `notes-lifecycle.test.ts` foi ajustado por causa disso.
- A senha inicial `CPF@DDMMAAAA` e a política de senha (≥8 caracteres, ≥1 dígito) têm
  um único dono cada: `domain/service/InitialPassword.ts` e
  `domain/service/PasswordPolicy.ts`. O frontend precisa espelhar a mesma política nas
  mensagens da tela de troca (task_03).

## Shared Learnings

- Rodar a suíte E2E local exige `docker stop cacau-center-backend-1` antes: o container de
  dev ocupa a porta 3001 e o `reuseExistingServer` do Playwright o adota, então o backend
  do e2e nunca sobe, o banco `cacau_e2e` fica sem migrar e o `POST /__control/reset`
  responde 500. Religar o container depois.
- O Chromium do Playwright roda sem root apesar das libs faltando: `apt-get download
  libnspr4 libnss3 libasound2t64`, `dpkg-deb -x` num diretório temporário e
  `LD_LIBRARY_PATH=<dir>/usr/lib/x86_64-linux-gnu npx playwright test`.
- O repositório não tem formatter configurado (nem biome nem prettier) e versiona
  `frontend/dist`/`backend/dist`: não rode `npx prettier` (reformata tudo para 80 colunas)
  e conte com o `dist/` sujo depois de qualquer `npm run build` de verificação.

- A migração torna `cpf`/`birth_date` `NOT NULL` sem default: qualquer banco com linhas
  em `users` precisa ser recriado ou sofrer backfill antes de migrar. Vale para o
  `cacau_test` local, para o e2e e para produção.
- Todo seed de usuário precisa de `cpf` + `birth_date` válidos. CPFs válidos já em uso:
  `52998224725` (operador), `12345678909` (gerente), `98765432100` (admin),
  `11144477735` (usado nos testes de `Cpf` e do bootstrap).
- O catálogo `_tests.md` desta feature reutiliza IDs (UT-037..UT-043) que já existem em
  `backend/test/unit/Auth.test.ts` vindos da feature anterior. Os testes novos moram em
  arquivos próprios para os IDs não colidirem no mesmo arquivo.

- O `control-server` do e2e semeia três contas (ADMIN, OPERADOR, GERENTE) a cada reset.
  A conta admin é `admin@loja.com`/`senha-admin`, CPF `98765432100`, nascimento
  `1975-11-05` — provisionada por seed porque, por ADR-001, ela nunca nasce de uma rota.

## Open Risks

- `scripts/bootstrap-admin.ts` não é compilado para `dist/` nem entra na imagem de
  runtime; em produção ele roda a partir do checkout, com dev deps e acesso à rede do
  compose (documentado em `DEPLOY.md`). Empacotá-lo na imagem continua em aberto.
- `SessionRevocationStore` perde estado em restart do backend — risco aceito na ADR-005,
  sem mitigação.

- Não existe navegação persistente no produto: cada papel cai na sua home e só troca de
  tela por URL. O PRD marca o cabeçalho de navegação como questão em aberto, e nenhuma
  task da feature o entregou — é o buraco mais visível que sobrou.
- A tela de recusa do `RequireRole` só tem texto para operador e gerente; em `/usuarios`
  a mensagem sai genérica ("exclusiva do papel gerente"). O bloqueio funciona; o texto é
  que mente.

## Handoffs

- task_04 (frontend): `src/test/session.tsx` (`withSession`) injeta uma sessão pronta nos
  testes de tela — obrigatório para qualquer tela que use `Screen`, porque o botão de sair
  no `header` consome `useSession`. `SessionContext` expõe `applyUser(user)` para gravar na
  sessão o corpo devolvido pelo servidor.

- task_03/task_04 (frontend): `GET /auth/me` e `POST /auth/login` já devolvem
  `{ id, name, role, mustChangePassword }`; `POST /auth/change-password` devolve o mesmo
  corpo e **reemite o cookie de sessão**, então não é preciso relogar depois da troca.
  `GET /users` devolve `{ users: [...] }` com `id`, `name`, `email`, `cpf`, `birthDate`,
  `role`, `active` e `mustChangePassword` — suficiente para a listagem e para
  pré-preencher o formulário de edição sem uma segunda chamada.
- Ainda não implementado (fora do escopo desta feature no backend): os usecases que
  mutam estado sensível logam só o `userId` alvo, não o do admin ator, porque as
  assinaturas de `Input` fixadas na TechSpec não carregam o ator. Adicionar o ator
  exigiria mudar esses contratos.
