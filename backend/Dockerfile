FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
# O `prepare` do workspace `shared` roda mesmo com `--ignore-scripts`, e aqui ainda não
# há código-fonte copiado. O build de `shared` é feito explicitamente abaixo.
RUN npm pkg delete scripts.prepare --workspace shared \
    && npm ci --ignore-scripts
COPY shared ./shared
COPY backend ./backend
RUN npm run build --workspace shared && npm run build --workspace backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
# O `prepare` do workspace `shared` roda mesmo com `--ignore-scripts` e chamaria `tsc`,
# que não existe sem devDependencies. O `dist` já vem pronto do estágio de build.
RUN npm pkg delete scripts.prepare --workspace shared \
    && npm ci --omit=dev --ignore-scripts
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/drizzle ./backend/drizzle
WORKDIR /app/backend
# A porta é dirigida por `PORT` (ver `main.ts`). O default da imagem acompanha a
# topologia de produção — `docker-compose.prod.yaml` e o `Caddyfile` falam com
# `backend:3000`; o compose de desenvolvimento sobrescreve para 3001.
ENV PORT=3000
EXPOSE 3000
# Menor privilégio: o runtime roda com o usuário `node` que já vem na imagem oficial.
# Nada é escrito em disco em tempo de execução (as migrations só leem `backend/drizzle`)
# e a porta é > 1024, então não é preciso reajustar posse de nada — deixar `/app` com
# dono `root` e o processo sem privilégio ainda impede que o app reescreva o próprio
# código caso uma dependência seja explorada.
USER node
CMD ["node", "dist/main.js"]
