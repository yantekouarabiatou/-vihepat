# VIHEPAT — Passation (28/09/2026)

Branche : `feat/circuit-soignant` (ne pas travailler directement sur `main`, synchronisée avec Lovable).

## Démarrer en local

Prérequis : Node.js 22, MySQL (XAMPP port 3306, ou `docker compose up -d` → port 3309).

```bash
# Backend
cd backend
cp .env.example .env      # adapter DB_PORT / DB_USER / DB_PASS à votre MySQL
npm install               # ⚠️ ne jamais lancer « npm audit fix --force » (rétrograde Sequelize en v3)
npm run db:seed           # crée les tables + données de démo
npm run dev               # http://localhost:4000

# Frontend (autre terminal)
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Comptes de démo (mot de passe `Password123!`) : soignant `aicha.kouassi@vihepat.org` ; patients `awa.mensah@example.com` (régulière), `grace.adjovi@example.com` (décroche, signalement sévère).

## Couverture du cahier de cadrage

| Pilier | État | Fait | Reste à faire |
|---|---|---|---|
| 1. Observance et rappels | ✅ | Prises du jour (Pris / Oublié), score 7 j / 30 j, série, histogramme, alertes d'examens (CV, CD4, transaminases, ARN VHC), rappels au texte neutre, demande de RDV | Faire valider les fréquences d'examens par l'équipe médicale (`backend/src/services/observance.service.ts`, `CALENDRIER_EXAMENS`) |
| 2. IA embarquée hors ligne | ✅ | Moteur de triage à règles embarqué banal / à surveiller / alerte (`frontend/src/lib/triage.ts`), PWA installable, file d'attente hors ligne, chat Claude en mode connecté | Faire valider les règles de triage par un médecin ; renseigner `ANTHROPIC_API_KEY` et vérifier le nom de modèle dans `chat.service.ts` |
| 3. Discrétion et séparation des rôles | 🟡 | Saisie bio et traitements réservée au soignant affecté, audit de chaque consultation et écriture, nom d'app installée « Mon carnet », notifications neutres, cache effacé à la déconnexion | Titre d'onglet et libellé « VIH » encore visibles côté patient, code PIN d'accès, mode discret, vérification du matricule des soignants |
| 4. Langues locales et pairs | 🟡 | i18n fr / en / fon sur l'accueil et le chat | Traduire les écrans patient/soignant (textes en dur en français), groupes de soutien à accès contrôlé (non commencé) |
| 5. Déploiement progressif | 🟡 | Docker Compose pour MySQL | Dockerfiles API + front, hébergement de démo, migrations Sequelize (aujourd'hui `sync` en dev) |

## Où trouver quoi

- Espace soignant : `frontend/src/features/soignant/` (file active, fiche patient `PatientDetailPage.tsx`)
- Espace patient : `frontend/src/features/patient/` (`ObservanceSection.tsx`, `TriageDialog.tsx`)
- Hors ligne : `frontend/public/sw.js`, `frontend/src/lib/offline-queue.ts`, `frontend/src/hooks/use-connexion.ts`
- API : `backend/src/routes/`, services dans `backend/src/services/` ; tables créées par `sequelize.sync()` au démarrage

## Tester le mode hors ligne

Recharger la page deux fois (activation du service worker), puis F12 → Network → **Offline**. Signaler un symptôme et cocher une prise : le bandeau indique les saisies en attente, envoyées automatiquement au retour du réseau.

## Points de vigilance

- `sequelize.sync()` ne crée que les tables manquantes : ajouter une colonne à une table existante exige de recréer la base (`DROP DATABASE` + seed) ou d'écrire une migration.
- Le refresh token n'est pas utilisé côté front (un 401 déconnecte).
- `frontend/src/components/ui/pagination.tsx` : 3 erreurs TypeScript préexistantes, fichier inutilisé.
