---
provider: manual
pr:
round: 3
round_created_at: 2026-08-19T14:29:48Z
status: resolved
file: backend/src/infra/controller/AuthController.ts
line: 22
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: No rate limiting or lockout on POST /auth/login

## Review Comment

`POST /auth/login` (`AuthController.ts:22-32`) has no throttling anywhere in the stack:
no `@nestjs/throttler` (or equivalent) is installed (`backend/package.json` has no such
dependency), no rate-limiting middleware exists in `backend/src`, and the `Caddyfile`
routes `/api/*` straight through to the backend with no rate limit directive.

`Login.execute` correctly returns the same generic message for both a wrong password and
a nonexistent email (UT-037/UT-038), which prevents user enumeration — but nothing slows
down an attacker who already knows or guesses a valid email and is brute-forcing the
password. Per `DEPLOY.md`, this endpoint is reachable over the public internet behind
Caddy's TLS termination, and the PRD explicitly treats the NFe/supplier data behind this
login as sensitive commercial information ("tratamento razoável desses dados como
informação comercial sensível da loja"). ADR-009 documents the 8h-session-length
tradeoff in detail but never discusses or accepts brute-force risk as a deliberate
scope cut, so this isn't a documented, intentional exception — it's a gap.

Given the small user base (a handful of accounts per store), even simple protection
meaningfully raises the cost of a credential-guessing attack.

Suggested fix: add `@nestjs/throttler` scoped to `POST /auth/login`, e.g.:

```ts
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Public()
@Post("login")
@HttpCode(200)
async signIn(...) { ... }
```

or, if a dependency addition is out of scope for this batch, add a rate-limit directive
at the Caddy edge for `/api/auth/login` specifically.

## Triage

- Decision: `VALID`
- Notes:

O apontamento procede: `POST /auth/login` era a única rota pública da API e não havia
nenhum freio de tentativas em toda a pilha (sem `@nestjs/throttler` no `backend/package.json`,
sem middleware de rate limit em `backend/src`, e o `Caddyfile` repassando `/api/*` direto).
A causa raiz é ausência de controle, não um bug: `Login.execute` já evita enumeração de
usuário, mas nada encarecia a adivinhação de senha de um e-mail conhecido, e a ADR-009
nunca registrou isso como corte de escopo consciente.

Correção aplicada (dependência `@nestjs/throttler` adicionada, conforme a sugestão do
próprio review):

- `backend/src/infra/guard/LoginThrottleGuard.ts` (arquivo novo): `ThrottlerGuard` com
  chave `IP|e-mail` — só por IP puniria a loja inteira atrás do Caddy, só por e-mail
  deixaria um atacante trancar a conta de um gerente. O 429 é devolvido no formato
  `{ statusCode, message }` do `ErrorFilter`, que é o que o cliente HTTP do frontend lê.
- `backend/src/infra/controller/AuthController.ts` (arquivo do escopo): `@UseGuards(LoginThrottleGuard)`
  aplicado só em `signIn`; `logout` e `me` seguem sem throttle.
- `backend/src/infra/module/AuthModule.ts`: `ThrottlerModule.forRootAsync` com limite e
  janela vindos de `LOGIN_RATE_LIMIT`/`LOGIN_RATE_TTL_SECONDS` (padrão 5/60s) e `skipIf`
  para `LOGIN_RATE_LIMIT=0`, que desliga o freio nas suítes que fazem muitos logins seguidos.
- `backend/src/bootstrap.ts`: `trust proxy` para que `req.ip` seja o IP real por trás do
  Caddy (ADR-011) e não o do proxy — sem isso a chave do throttle colapsaria em um só valor.
- Fora do `backend/src`, o mínimo necessário para a configuração existir de fato:
  `.env.example`, `docker-compose.prod.yaml` e `DEPLOY.md` (documentação das duas variáveis),
  e `playwright.config.ts` com `LOGIN_RATE_LIMIT=0` para o E2E não esbarrar no freio.

Testes: `backend/test/integration/login-throttle.test.ts` cobre o 429 após o limite
(inclusive com a senha correta na tentativa bloqueada) e a não-punição de outra conta no
mesmo IP; `backend/test/support/TestApp.ts` passou a desligar o freio por padrão.

Verificação: `npm run typecheck` (0 erros), `npm test` (backend 88/88, frontend 49/49) e
`npm run build` (exit 0), todos rodados após as mudanças.
