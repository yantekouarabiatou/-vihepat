# --- Stage 1 : build (TypeScript -> JavaScript) ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2 : exécution ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

# API compilée
COPY --from=builder /app/dist ./dist
# Migrations, seed et config sequelize-cli : lus directement en TypeScript via
# `npm run db:migrate` / `npm run db:seed` (ts-node), pas via le build tsc.
COPY --from=builder /app/src ./src
COPY --from=builder /app/.sequelizerc ./.sequelizerc

EXPOSE 4000
CMD ["node", "dist/server.js"]
