# Imagem da API (serve também o site e o painel). Use com Fly.io, Railway, VPS etc.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci
ENV VITE_DATA_MODE=api
RUN npm run export && npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 WEB_DIST_DIR=apps/web/dist
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8787
CMD ["npm", "run", "start", "-w", "@pgi/api"]
