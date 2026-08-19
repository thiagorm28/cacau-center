---
provider: manual
pr:
round: 1
round_created_at: 2026-08-18T04:40:33Z
status: resolved
file: backend/Dockerfile
line: 28
severity: low
author: claude-code
provider_ref:
---

# Issue 005: Dockerfile EXPOSE 3001 doesn't match the prod runtime port

## Review Comment

`backend/Dockerfile` declares `EXPOSE 3001` and its comment says "Porta fixa do serviço
em desenvolvimento" style reasoning, matching `main.ts`'s `DEFAULT_PORT = 3001`. But
`docker-compose.prod.yaml` overrides this at runtime with `PORT: "3000"` and `expose:
["3000"]`, and `Caddyfile`/`DEPLOY.md` both route to `backend:3000`. The app does end up
listening on the right port in prod (driven by the `PORT` env var), so this isn't
functionally broken, but the Dockerfile's `EXPOSE 3001` is misleading metadata — anyone
inspecting the image or running `docker inspect` sees a port that's never actually used
in the production topology described by this same PR.

Suggested fix: change `EXPOSE 3001` to `EXPOSE 3000` (or drop the fixed `EXPOSE` and
document that the port is env-driven), so the Dockerfile doesn't contradict
`docker-compose.prod.yaml`/`Caddyfile`.

## Triage

- Decision: `VALID`
- Notes:

**Confirmação do problema.** As referências citadas batem: `docker-compose.prod.yaml:45,47`
define `PORT: "3000"` / `expose: ["3000"]`, `Caddyfile:19` faz `reverse_proxy backend:3000`
e `DEPLOY.md:7` documenta `/api/* -> backend:3000`. O `EXPOSE 3001` original contradizia
toda essa topologia.

**Causa raiz.** O mesmo `backend/Dockerfile` serve os dois composes — o de
desenvolvimento (`docker-compose.yaml:30-32`, `PORT: "3001"`, `ports: 3001:3001`) e o de
produção (`3000`). Um `EXPOSE` com número fixo não podia estar correto para ambos, e o
valor escolhido (3001) espelhava apenas o `DEFAULT_PORT` de `main.ts`, não a topologia de
produção descrita neste mesmo PR.

**Correção aplicada.** Trocar só o número de `EXPOSE` criaria uma contradição nova: a
imagem executada sem `PORT` continuaria escutando em 3001 (fallback de `main.ts`)
enquanto anunciaria 3000. Por isso o `Dockerfile` passou a declarar `ENV PORT=3000` junto
de `EXPOSE 3000`, com comentário registrando que a porta é dirigida por env. Assim os três
cenários ficam coerentes:

- imagem isolada (`docker run` sem `PORT`): escuta 3000, `EXPOSE` 3000;
- produção: `PORT=3000` explícito, `expose` 3000, Caddy em `backend:3000`;
- desenvolvimento: `PORT=3001` sobrescreve o default da imagem, e o mapeamento explícito
  `ports: 3001:3001` independe do `EXPOSE` (que é apenas metadado).

**Nenhuma mudança de comportamento nas orquestrações existentes**, já que ambos os composes
definem `PORT` explicitamente.

**Verificação (evidência de execução real).** Sem teste automatizado aplicável a metadado
de imagem, a verificação foi feita contra a imagem construída e em runtime:

- `docker image inspect` -> `ExposedPorts: {"3000/tcp":{}}` e `PORT=3000`;
- container sem `PORT`: log `backend ouvindo na porta 3000`, `netstat` mostra `:::3000 LISTEN`;
- container com `PORT=3001` (cenário do compose de desenvolvimento): log `backend ouvindo
  na porta 3001`, `netstat` mostra `:::3001 LISTEN` — confirma que o override continua valendo;
- `docker compose config` OK para `docker-compose.yaml` e `docker-compose.prod.yaml`;
- pipeline completo do repositório a partir da raiz: `npm run typecheck`, `npm run test`
  (18 arquivos, 113 testes, 0 falhas) e `npm run build` — todos exit 0.
