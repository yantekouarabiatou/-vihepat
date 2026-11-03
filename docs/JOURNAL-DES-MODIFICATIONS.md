# VIHEPAT : journal des modifications

Toutes les modifications faites avec Claude Code depuis le 26 octobre 2026, branche `feat/circuit-soignant`.
Les commits sont listés du plus récent au plus ancien ; tout ce qui figure ici est en production sur
https://vihepat.secourseducatif.com, sauf mention contraire.

## 3 novembre 2026

### Traiter un signalement avec le dossier du patient (ce commit)
- **Panneau « Traiter le signalement »** (`frontend/src/features/soignant/TraitementSignalement.tsx`) : ouvert depuis la page Signalements (bouton « Traiter » sur chaque ligne), le tableau de bord et la cloche (`/soignant/signalements?traiter=<id>`).
  - le signalement : symptôme, gravité, statut, date, notes du patient ;
  - le dossier associé : identité, téléphone cliquable, observance sur 30 jours, risque de perte de suivi, traitements en cours, derniers examens, autres signalements récents, prochains rendez-vous ;
  - les actions : marquer vu, marquer traité, programmer un rendez-vous (motif prérempli « Suite au signalement : … »), ouvrir le dossier complet.
- Ouvrir le panneau charge le dossier : la consultation est tracée dans le journal d'audit, comme l'ouverture d'un dossier.

### Évaluations demandées par l'audit (ce commit)
- Matrice de confusion 3×3 et F1 par classe du triage : `ia/RESULTATS_TRIAGE_MATRICE.md` (script `ia/scripts/matrice_triage.py`).
- Veille des mots sensibles : 47/50 signalés, 6/40 fausses alertes (`ia/resultats/mots_sensibles.md`).
- ElevenLabs sur les 18 vraies notes : 9,8 % d'erreur de mots en français, fon 9/9 écarté, 1 alerte ratée (`ia/resultats/elevenlabs__reel.md`).
- Assistant conversationnel : 34/35 conformes après relecture humaine, 6/6 injections de consigne sans effet (`ia/resultats/assistant.md`).
- `backend/src/services/chat.service.ts` : la préparation de la requête Gemini est isolée dans `requeteChatGemini` pour être évaluée sans écrire en base (comportement inchangé).
- Synthèse ajoutée à `ia/RESULTATS.md`, audit mis à jour.

### `a3afb35` docs(audit) : zod 4 actif en production
### `f768437` Programme de déploiement par le cPanel (HTTPS)
- Le pare-feu de l'hébergeur bloque le FTP pour notre adresse IP : `backend/scripts/embarquer-dependances.mjs` passe désormais par l'interface du cPanel (port 2083), avec un jeton d'API.
### `bc288ac` Programme pour mettre à jour une librairie sans SSH
- Regroupe une librairie (esbuild) et la dépose dans `vihepat-api/dist/node_modules/`, que Node préfère au dossier commun du serveur. Utilisé pour installer zod 4.
### `8d9e924` Rappel des signes graves renforcé
- Prompt `extraction-v2` (archivé avec la v1 dans `ia/prompts/`), lexique des signes graves (`backend/src/ia/signes-graves.ts`) et union des deux dans le triage vocal.
- Sur un jeu de contrôle figé : 0/49 alerte ratée (4/49 avant). Détails : `ia/RESULTATS_SIGNES_GRAVES.md`.
### `2b1919f` Sécurité et audit
- zod 4 dans l'API, `shadcn` déplacé dans les outils de développement, vite 8.3.5 : 0 vulnérabilité haute.
- E-mails patient de bienvenue et de nouveaux identifiants : objet et expéditeur neutres.
- `mail.service` découpé en petits modules (l'antivirus de l'hébergeur refusait le fichier unique).
- `docs/AUDIT-IA-RESPONSABLE.md` : audit IA responsable.

## 2 novembre 2026

### `3ac89c6` Médecin, signalements, groupes avec pseudonymes
- Rôles : le médecin suit tous les patients ; l'ancien « Administrateur » devient « Super administrateur ».
- Page **Signalements** (tableau avec recherche, tri, filtres) ; **cloche** de notifications avec les nouveaux signalements ; liste des patients en tableau de données.
- Groupes de soutien : **pseudonymes** (initiales + nom généré), réponses citées, réactions « Je vous soutiens » / « Merci », **signalement d'un message par un membre**.
- `soignant.service` et `groupe.service` découpés en petits modules pour l'antivirus de l'hébergeur.

## 30 octobre 2026

### `6c04e85` Communautés
- Page **Communautés** : l'équipe soignante lit les discussions des groupes ; veille des mots sensibles (détresse, arrêt du traitement, insultes, stigmatisation, coordonnées), sans blocage automatique ; e-mail au soignant référent en cas de détresse.

## 29 octobre 2026

### `ca9331a` Score de risque de perte de suivi
- Modèle de perte de suivi (régression logistique, cohorte LUTH) recalculé dans l'API, vérifié sur 30 cas scikit-learn au démarrage ; saisie du **bilan d'inclusion** ; carte de risque dans le dossier et pastille dans les listes.
### `82efa25` Espaces connectés et administration adaptés au mobile
### `b0c754e` Menu de la page d'accueil adapté au mobile
### `2d78173` Transcription des notes vocales par ElevenLabs, Gemini en secours

## 28 octobre 2026

### `0842b19`, `ca96544` Modèle de perte de suivi (branche `ursus`, intégrée)

## Hors commits (actions en production)

- 26-27/10 : création de comptes administrateurs par scripts SQL (`deploiement-2026-10-26/`, `deploiement-2026-10-27/`, non versionnés).
- Sauvegardes des fichiers remplacés en production : `deploiement-AAAA-MM-JJ/api-ancien/` (non versionnés).
