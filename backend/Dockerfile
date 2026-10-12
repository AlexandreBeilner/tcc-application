FROM node:22.23.3-alpine3.24 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.23.3-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Tarefa 6.10.8 — ponto de montagem do volume `avatar_data`
# (docker-compose.yml) já criado e dono do `node` (container roda sem
# root, `USER node` abaixo): sem isso, o primeiro `mkdir`/`writeFile` de
# `diskAvatarStorage.ts` bate em EACCES, já que um volume nomeado nasce
# root-owned quando o diretório não existe antes no próprio estágio da
# imagem.
RUN mkdir -p /data/avatars && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
