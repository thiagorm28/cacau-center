# Deploy em produção (VPS + Docker Compose + Caddy)

Topologia decidida na [ADR-011](.compozy/tasks/conferencia-notas-fiscais/adrs/adr-011.md):
um VPS único roda `postgres`, `backend`, `frontend` (build estático do PWA) e `caddy`,
que termina TLS automático (Let's Encrypt) e roteia o tráfego:

- `/api/*` → `backend:3000` (o prefixo `/api` é removido pelo Caddy; o backend expõe
  `/auth`, `/notes` e `/scan-events` sem prefixo global).
- todo o resto → `frontend:80`, o build estático servido com fallback de SPA.

HTTPS não é opcional: o PWA só é instalável e só acessa a câmera sob TLS (fora de
`localhost`).

## Pré-requisito bloqueante: conectividade com a API da Cacau Show

A integração de importação de NFe depende de
`http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML`, que aparenta ser um
servidor de relatórios da **rede interna** da Cacau Show. Se o VPS não alcançar esse host
pela internet pública, a Core Feature 1 não funciona em produção (ver `_techspec.md` →
Technical Dependencies / Known Risks).

**Valide isso no VPS candidato antes de fechar o provedor e antes do go-live:**

```bash
# 1. Resolução de DNS
getent hosts hybrisreports.cacaushow.com.br

# 2. Alcançabilidade HTTP (espera-se um status HTTP, não timeout/conexão recusada)
curl -sS -o /dev/null -w '%{http_code} em %{time_total}s\n' --max-time 10 \
  http://hybrisreports.cacaushow.com.br/

# 3. Chamada real do endpoint, com o código da loja e um número de faturamento conhecido
curl -sS --max-time 15 \
  "http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML?empresa=$EMPRESA_CODE&documento=<numeroFaturamento>" \
  | head -c 400
```

Critério de aprovação: o passo 3 devolve XML contendo `<nfeProc`. Timeout, `Connection
refused` ou falha de DNS significam que o endpoint não é público — nesse caso, o deploy
precisa de VPN/túnel até a rede da Cacau Show (trabalho adicional fora do escopo do
TechSpec atual). Vale também confirmar com a Cacau Show se existe allowlist de IP: a API
não apresenta autenticação visível, o que sugere controle de acesso por rede.

## Subir o stack

```bash
cp .env.example .env    # preencher com os valores reais do ambiente
docker compose -f docker-compose.prod.yaml config          # valida a composição
docker compose -f docker-compose.prod.yaml up -d --build
docker compose -f docker-compose.prod.yaml logs -f backend
```

O `backend` aplica as migrations do Drizzle no boot (schema default `public`); não há
passo de migração manual. Os certificados ficam no volume `caddy-data` — preserve-o entre
recriações, senão o rate limit do Let's Encrypt é atingido rapidamente.

Antes do primeiro `up` com domínio real: apontar os registros A/AAAA do domínio para o IP
do VPS e liberar as portas 80 e 443 no firewall — o desafio ACME depende das duas.

## Smoke test local (sem domínio/TLS)

Serve para conferir o encanamento do stack, não a operação completa:

```bash
SITE_ADDRESS=:80 docker compose -f docker-compose.prod.yaml up -d --build
curl -si http://localhost/ | head -n 1                 # PWA servido pelo Caddy
curl -si http://localhost/api/auth/me | head -n 1      # rota da API via Caddy
docker compose -f docker-compose.prod.yaml down
```

Esperado: `200` no primeiro (HTML do PWA) e `401` no segundo — o `401` já vem do
`AuthGuard` do NestJS, ou seja, o roteamento `/api/*` → backend está correto. Login não
funciona nesse modo: o cookie de sessão é `Secure` (ADR-009) e o navegador o descarta em
HTTP puro. Isso é esperado e só afeta o smoke test.

## Variáveis de ambiente

Todas ficam em `.env` (não versionado); `.env.example` é o template. Ver os comentários
lá para o significado de cada uma: `SITE_ADDRESS`, `TLS_EMAIL`, `PUBLIC_ORIGIN`,
`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, `DATABASE_URL`, `JWT_SECRET`,
`EMPRESA_CODE`, `NFE_BASE_URL`, `LOGIN_RATE_LIMIT`/`LOGIN_RATE_TTL_SECONDS`.

`POST /api/auth/login` é a única rota pública exposta pelo Caddy, então ela tem freio de
força bruta: `LOGIN_RATE_LIMIT` tentativas por `LOGIN_RATE_TTL_SECONDS` segundos para
cada par (IP de origem, e-mail tentado), respondendo `429` acima disso. O IP vem do
`X-Forwarded-For` que o Caddy injeta (o backend confia em 1 salto de proxy;
`TRUST_PROXY_HOPS` ajusta se um dia houver outra camada na frente). A contagem é em
memória do processo do backend, o que basta para o deploy de instância única deste
compose — com réplicas, cada uma teria seu próprio contador.
