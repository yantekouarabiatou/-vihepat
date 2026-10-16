# Rappels discrets (prises et rendez-vous)

## Ce qui est en place

| Élément | Où | Détail |
|---|---|---|
| Écran « Mes rappels » | `frontend/src/features/patient/RappelsPage.tsx` (route `/rappels`, icône réveil dans l'en-tête patient) | Créer, modifier, activer/désactiver, supprimer. Libellé libre, heure, jours (tous les jours ou choisis), type prise / rendez-vous. Exemples neutres : « Rappel 1 », « Vitamines », « Pause ». |
| Stockage | `frontend/src/lib/rappels.ts` | Sur l'appareil uniquement (`localStorage`, une clé par compte). Le libellé, l'heure et les réglages ne quittent jamais le téléphone. |
| Moteur d'alarme | `frontend/src/hooks/use-moteur-rappels.ts` | Vérifie les échéances toutes les 20 s et au retour au premier plan, sans réseau. Alerte → une seule relance après le délai choisi → « non confirmé ». |
| Notification | `afficherAlerte()` + `frontend/public/sw.js` | Titre neutre configurable (« Rappel », « C'est l'heure » ou texte libre), corps fixe « Appuyez pour répondre ». Jamais le libellé ni de mot médical. Actions « C'est fait » / « Plus tard (10 min) ». |
| Son | réglage « Son » | Son et vibration / Vibration seule / Silencieux discret. |
| Confirmations | `offline-queue.ts` → `POST /api/patients/me/rappels/confirmations` | Mises en file sur l'appareil, envoyées au retour du réseau (idempotent : `clientId` unique). |
| Partage | réglage « Partager mes confirmations » → `PUT /api/patients/me/rappels/partage` | Couper le partage efface les confirmations déjà transmises et plus rien n'est envoyé. |
| Vue soignant | `GET /api/soignant/patients/:id` → carte « Rappels du patient » | Compteurs agrégés sur 30 jours (prises confirmées / non confirmées, rendez-vous honorés / non confirmés). Indicateur « à regarder » après 3 prises non confirmées d'affilée : aide à la priorisation, aucune décision automatique. |
| Journal d'audit | `POST /api/patients/me/rappels/journal` | `RAPPEL_CREE`, `RAPPEL_MODIFIE`, `RAPPEL_SUPPRIME`, `RAPPEL_ACTIVE`, `RAPPEL_DESACTIVE`, `RAPPELS_PARTAGE_ACTIVE`, `RAPPELS_PARTAGE_COUPE` : l'action seule, sans contenu. |

Aucun rappel n'est envoyé par SMS ni par e-mail.

## Limites d'une PWA (état 2026)

| Besoin | Android (Chrome) | iOS / iPadOS (Safari, PWA installée) | Ordinateur |
|---|---|---|---|
| Alarme application **ouverte** ou en arrière-plan récent | Oui | Oui (iOS 16.4+, PWA ajoutée à l'écran d'accueil) | Oui |
| Alarme application **fermée**, sans réseau | **Non** : aucune API web standard de notification programmée (Notification Triggers abandonné) | **Non** | **Non** |
| Alarme application fermée, **avec** réseau | Possible via Web Push envoyé par le serveur | Possible via Web Push (PWA installée uniquement) | Possible |
| Boutons « C'est fait » / « Plus tard » dans la notification | Oui | Non : l'appui ouvre l'application sur `/rappels` | Selon navigateur |
| « Vibration seule » | Partiel : une notification web est soit sonore, soit silencieuse (pas de vibration sans son). Le mode « Vibration seule » affiche donc la notification **sans son**, et vibre si l'application est au premier plan. | Non (l'OS décide) | — |
| Masquer le nom de l'application | Non : le navigateur affiche le nom de la PWA (« Mon carnet », déjà neutre) ou le domaine | Idem | Idem |
| Contenu sur l'écran verrouillé | Contrôlé par l'OS ; le contenu étant neutre, rien de sensible ne s'affiche | Idem | — |

## Solution retenue et plans de repli

1. **Application ouverte ou en arrière-plan** : moteur local + notifications du service worker (en place).
2. **Plan B, en place : agenda du téléphone.** Le bouton « Ajouter à l'agenda du téléphone » exporte un fichier `.ics` (titre neutre, alarme intégrée, répétition quotidienne ou par jours). Les alarmes d'agenda sonnent **hors ligne, application fermée, sur iOS comme sur Android**. Le libellé personnel n'y figure pas.
3. **Plan C, à prévoir : Web Push.** Le serveur enverrait, à l'heure prévue, une notification au contenu neutre. Il faudrait que le serveur connaisse les heures (pas les libellés), une clé VAPID et la bibliothèque `web-push`. Cela ne fonctionne qu'avec du réseau.
4. **Solution pérenne : application native légère.** Avec Capacitor (`@capacitor/local-notifications`), on enveloppe la PWA existante. Les alarmes deviennent exactes et hors ligne, avec actions et canal « vibration seule » sur Android, et le nom ou l'icône de notification peut être neutre.

## Langues

Tous les textes sont dans `frontend/src/i18n/locales/{fr,en}.json` (espaces de noms `rappels`, `rappels_soignant`). Pour ajouter l'ewe ou le baatonou : créer `ee.json` / `bba.json` avec les mêmes clés et les enregistrer dans `frontend/src/i18n/index.ts` et dans le sélecteur de langue. Toute clé absente retombe sur le français. La phrase vocale (`rappels.phrase_vocale`) est neutre.
