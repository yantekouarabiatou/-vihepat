# VIHEPAT

Assistant intelligent de suivi des patients vivant avec le VIH et les hépatites virales.
Hackathon Technologie & Intelligence Artificielle, édition 2 — équipe VIHEPAT-Bénin.

## Stack

| Couche | Technologies |
|---|---|
| Frontend (`frontend/`) | React 19, Vite, Tailwind + shadcn/ui, React Query, Zustand, i18next (fr / en / fon) |
| Backend (`backend/`) | Node.js, Express, Sequelize, MySQL 8, JWT, Zod |
| IA | Chat de signalement de symptômes (API Anthropic, tool use) |
| Infra locale | Docker Compose (MySQL + Adminer) |

## Prérequis

- Node.js 22 LTS (Vite 8 exige Node ≥ 20.19)
- Docker Desktop

## Démarrage en local

```bash
# 1. Base de données (MySQL sur le port 3309, Adminer sur http://localhost:8080)
docker compose up -d

# 2. API (http://localhost:4000)
cd backend
cp .env.example .env        # Windows : copy .env.example .env
npm install
npm run db:seed             # crée les tables et les données de démo
npm run dev

# 3. Frontend (http://localhost:5173), dans un autre terminal
cd frontend
cp .env.example .env        # Windows : copy .env.example .env
npm install
npm run dev
```

Renseigner `ANTHROPIC_API_KEY` dans `backend/.env` pour activer le chat IA (sinon l'API répond 503 sur ce seul point).

Vérification : `http://localhost:4000/health`

## Comptes de démonstration

Mot de passe commun : `Password123!`

| Rôle | Email |
|---|---|
| Soignant | aicha.kouassi@vihepat.org |
| Soignant | jean.houngbo@vihepat.org |
| Patient | awa.mensah@example.com |
| Patient | kofi.agossou@example.com |

## API — principales routes

| Rôle | Méthode | Route |
|---|---|---|
| Public | POST | `/api/auth/register/patient`, `/api/auth/register/soignant`, `/api/auth/login`, `/api/auth/refresh` |
| Patient | GET | `/api/patients/me/{rendez-vous,traitements,observations,signalements}` |
| Patient | POST | `/api/patients/me/rendez-vous`, `/api/patients/me/signalements`, `/api/patients/me/chat` |
| Soignant | GET | `/api/soignant/patients`, `/api/soignant/patients/:id` |
| Soignant | POST | `/api/soignant/patients/rattacher`, `/api/soignant/patients/:id/observations`, `/api/soignant/patients/:id/traitements` |
| Soignant | PATCH | `/api/soignant/traitements/:id`, `/api/soignant/rendez-vous/:id`, `/api/soignant/signalements/:id` |

Chaque lecture de dossier et chaque écriture par un soignant est tracée dans `audit_logs`.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
