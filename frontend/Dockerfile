# --- Stage 1 : build (Vite) ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
# Pas de package-lock.json copié, et `npm install` (pas `npm ci`) : le lockfile
# du dépôt a été généré sur Windows, et un bug connu de npm
# (github.com/npm/cli/issues/4828) fait qu'un lockfile venant d'un autre OS
# bloque la résolution du binding natif optionnel de la bonne plateforme (ici
# le binding linux de rolldown, utilisé par Vite 8) — même avec `npm install`.
# En ne copiant pas le lockfile, npm résout et installe les optionalDependencies
# nativement pour la plateforme du conteneur (linux-x64-musl sur Alpine).
RUN npm install

COPY . .
# L'URL de l'API est injectée au build (Vite en fait une variable statique).
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Stage 2 : service statique (nginx) ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
