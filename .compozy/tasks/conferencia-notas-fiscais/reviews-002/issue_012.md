---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: backend/Dockerfile
line: 14
severity: medium
author: claude-code
provider_ref:
---

# Issue 012: Backend and frontend containers run as root

## Review Comment

Neither Dockerfile's runtime stage sets a non-root `USER`. `node:22-alpine` (backend)
and `caddy:2-alpine` (frontend's static server) both default to root when unspecified,
so both the NestJS process and the static file server run as root inside their
containers — a standard least-privilege gap: a container escape or RCE in any
dependency would have root inside the container.

Suggested fix: for `backend`, add a non-root user before the final `CMD` (e.g. `USER
node`, adjusting ownership of `/app` in the build stage accordingly). For `frontend`,
either adopt Caddy's non-root image variant/configuration or explicitly document why
root is acceptable — currently the choice is silent rather than deliberate.

## Triage

- Decision: `VALID`
- Notes:

Procede. Sem `USER`, o Docker roda o processo como uid 0: `node:22-alpine` traz o
usuário `node` (uid 1000) mas não o seleciona, e `caddy:2-alpine` também fica em root.
Nos dois casos o processo tinha privilégio de escrita sobre o próprio código servido
(`/app/backend/dist`, `/srv`), então uma RCE em dependência conseguiria reescrever o
artefato — exatamente a lacuna de menor privilégio descrita no comentário.

Causa raiz: os dois estágios de runtime herdam o default do Docker (root) porque nenhum
`USER` foi declarado; não é uma escolha deliberada, é omissão.

Abordagem da correção — checada contra o que cada processo precisa em disco:

- `backend/Dockerfile`: `USER node` antes do `CMD`. Não é preciso reajustar posse de
  `/app`. O processo não escreve nada em disco — `bootstrap.ts:42` roda as migrations
  pelo `drizzle-orm/node-postgres/migrator`, que só **lê** `process.cwd()/drizzle`
  (`/app/backend/drizzle`, copiado world-readable) e grava o journal no Postgres. Deixar
  `/app` com dono `root` é o comportamento desejado: impede o app de reescrever o próprio
  `dist`. `PORT=3000` é > 1024, então o bind não precisa de privilégio. Nenhum dos dois
  composes faz bind mount sobre `/app`, então não há conflito de uid com o host.
- `frontend/Dockerfile`: `USER nobody` mais `chown -R nobody:nobody /data /config`. O
  Caddy só lê `/srv` e `/etc/caddy/Caddyfile`, mas grava o autosave da config em
  `$XDG_CONFIG_HOME` — a imagem oficial aponta `XDG_CONFIG_HOME=/config` e
  `XDG_DATA_HOME=/data`, e sem posse desses dois o boot falha. O serviço `frontend` do
  `docker-compose.prod.yaml` não monta volume neles, então o `chown` da imagem vale em
  runtime. A porta segue 80 porque o `Caddyfile` da borda fala com `frontend:80`; o
  Docker define `net.ipv4.ip_unprivileged_port_start=0` por padrão desde a 20.10, então
  um processo sem privilégio consegue escutar nela.

Arquivo fora do `<batch_scope>`: o escopo lista só `backend/Dockerfile`, mas o issue cobre
explicitamente os dois runtimes e um `frontend/Dockerfile` que continuasse em root deixaria
metade do achado aberto. A mudança em `frontend/Dockerfile` foi mantida no mínimo — duas
linhas (`RUN chown`/`USER`) mais o comentário do porquê, sem tocar em build, Caddyfile ou
qualquer outro comportamento.

O `caddy` de borda (`docker-compose.prod.yaml`) continua em root de propósito: usa a imagem
oficial direta, sem Dockerfile no repositório, e precisa de root para o bind em 443 e para
gravar as chaves ACME nos volumes `caddy-data`/`caddy-config`. Fora do escopo deste issue.

### Verificação

Mudança de `Dockerfile` não tem teste automatizado no repositório, então a prova é em
runtime (build + inspect + container), além do pipeline padrão.

Metadados da imagem:

```
backend  User=node    Exposed={"3000/tcp":{}}
frontend User=nobody  Exposed={"80/tcp":{},"443/tcp":{},"443/udp":{},"2019/tcp":{}}
```

Backend em container contra o Postgres de desenvolvimento:

```
uid=1000(node) gid=1000(node) groups=1000(node)
[Bootstrap] backend ouvindo na porta 3000          # sem PORT: default da imagem
[Bootstrap] backend ouvindo na porta 3001          # com PORT=3001 (docker-compose.yaml)
```

As migrations aplicam sem privilégio — `pg_tables` do container do Postgres devolve
`invoice_notes`, `note_items`, `scan_events`, `users`. O healthcheck do
`docker-compose.prod.yaml` (`GET /auth/me` sem cookie) responde `401`, o status que ele
espera.

Frontend em container:

```
uid=65534(nobody) gid=65534(nobody) groups=65534(nobody)
nobody  caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
GET /                 -> 200
GET /conferencia/123  -> 200   # fallback de SPA continua de pé
```

O log do Caddy confirma que o `chown` não é decorativo: ele grava
`autosaved config ... "file":"/config/caddy/autosave.json"` e limpa
`"storage":"FileStorage:/data/caddy"` — sem posse de `/config` e `/data` o boot falharia.

A propriedade de segurança que o issue pede foi testada diretamente, e não só inferida do
`USER`:

```
touch /app/backend/dist/evil.js    -> Permission denied
touch /app/backend/drizzle/evil.sql -> Permission denied
touch /srv/evil.js                 -> Permission denied
touch /etc/caddy/evil              -> Permission denied
```

`docker compose config -q` passa nos dois composes. Pipeline do repositório, rodado depois
da mudança: `npm run typecheck` (backend + frontend + e2e) exit 0, `npm run build` exit 0,
`npm test` exit 0 com 20 arquivos e 142 testes passando (shared 12, backend 84, frontend 46).

`npm run test:e2e` não foi executado: o `playwright.config.ts` sobe `backend` e `frontend`
por `npm`, sem construir imagem alguma, então nenhum caminho da suíte E2E toca estes
`Dockerfile`s.
