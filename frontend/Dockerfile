# Build de produção do PWA + servidor estático. O contexto de build é a raiz do
# monorepo, porque o `frontend` consome o workspace `shared` pelo código-fonte.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
# O `prepare` do workspace `shared` roda mesmo com `--ignore-scripts` e falharia aqui:
# o código-fonte ainda não foi copiado. O Vite consome `shared` pelo fonte (alias), então
# nenhum build daquele pacote é necessário.
RUN npm pkg delete scripts.prepare --workspace shared \
    && npm ci --ignore-scripts
COPY shared ./shared
COPY frontend ./frontend
# Base da API embutida no bundle em tempo de build (ADR-011: mesma origem, prefixo
# `/api`, removido pelo Caddy de borda antes de chegar ao backend).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace frontend

FROM caddy:2-alpine AS runtime
COPY frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
# Menor privilégio: a imagem oficial do Caddy roda como root por default. Aqui o processo
# só lê `/srv` e o Caddyfile, então `nobody` basta — e nem o conteúdo servido nem a
# configuração ficam graváveis por ele. Só `/data` e `/config` (storage do Caddy, apontado
# por `XDG_*` na imagem) precisam de posse, senão o boot falha ao criar o diretório.
# A porta segue 80 (o `Caddyfile` da borda fala com `frontend:80`): o Docker define
# `net.ipv4.ip_unprivileged_port_start=0`, então um processo sem privilégio consegue
# escutar nela.
RUN chown -R nobody:nobody /data /config
USER nobody
EXPOSE 80
