# Exact Screenshot

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2f7f982f-6ebb-49ea-8605-54003aab0d90).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

## React, Express et MySQL

Le frontend React tourne sur Vite et l'API Express sur le port `3001`.

1. Copiez `.env.example` vers `.env` et renseignez `MYSQL_URL`.
2. Créez la base MySQL `exact_screenshot`.
3. Installez les dépendances avec `bun install`.
4. Lancez le frontend avec `bun run dev`.
5. Lancez l'API avec `bun run dev:api`.

Le contrôle de connexion est disponible sur `http://localhost:3001/api/health`.

Les migrations Drizzle se génèrent avec `bun run db:generate` puis s'appliquent avec `bun run db:migrate`.
