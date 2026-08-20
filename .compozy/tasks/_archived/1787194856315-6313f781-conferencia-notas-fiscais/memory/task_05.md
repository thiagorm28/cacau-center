# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Topologia de produção da ADR-011 (VPS único: postgres + backend + build estático do PWA
+ Caddy com TLS automático). Concluída e validada com `config` e smoke test HTTP local.

## Important Decisions

- Roteamento `/api/*` do ADR-011 resolvido com `handle_path` no Caddy (remove o prefixo)
  + `VITE_API_URL=/api` como build arg do frontend. O backend não ganhou prefixo global
  de rota — nenhuma linha de código de aplicação foi tocada.
- Variáveis sensíveis usam `${VAR}` puro (sem `:?`) no compose: assim
  `docker compose config` valida sem `.env` (critério de sucesso da task) e a falta de
  valor ainda falha alto no boot (`requireEnv` do backend, senha vazia recusada pelo
  Postgres) em vez de cair num default fraco.
- `SITE_ADDRESS` é o interruptor entre produção (domínio -> Let's Encrypt) e smoke test
  local (`:80`, HTTP puro).

## Learnings

- Login não funciona no smoke test HTTP: o cookie de sessão é `Secure` (ADR-009) e o
  navegador o descarta fora de HTTPS. Esperado; o smoke test valida só o encanamento.
- A suíte do `backend` exige o banco `cacau_test` já criado no Postgres local
  (`TestApp.ts` não cria o database, só roda migrations). Sem ele, os 4 arquivos de
  integração falham com `3D000`.

## Files / Surfaces

- Criados: `docker-compose.prod.yaml`, `Caddyfile`, `frontend/Caddyfile`,
  `frontend/Dockerfile`, `.env.example`, `DEPLOY.md`, `.gitignore`, `.dockerignore`.
- Modificado: `backend/Dockerfile` (correção do `npm ci`, ver Errors/Corrections).

## Errors / Corrections

- `backend/Dockerfile` (Task 2) nunca chegou a buildar: o `prepare` do workspace
  `shared` roda mesmo com `--ignore-scripts` e chamava `tsc` antes do fonte existir /
  sem devDependencies. Corrigido com `npm pkg delete scripts.prepare --workspace shared`
  antes do `npm ci` nos dois estágios; o mesmo cuidado foi aplicado ao
  `frontend/Dockerfile` novo.

## Ready for Next Run

- Pendência operacional (não de código): validar do VPS escolhido o acesso a
  `http://hybrisreports.cacaushow.com.br` — procedimento pronto em `DEPLOY.md`.
