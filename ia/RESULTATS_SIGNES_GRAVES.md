# Signes de gravité : renforcement du rappel (3 novembre 2026)

Sur le jeu de contrôle, la version mise en production (prompt v2 + lexique v2, en union) ne laisse **aucun message grave sans alerte (0/49)**, contre 4/49 avec le prompt v1 utilisé jusque-là, pour une fausse alerte sur 21 messages négatifs (2/21 avant).

## Méthode

Deux jeux de messages fictifs, écrits par l'équipe et **figés par leur empreinte SHA-256 avant toute correction** :

| Jeu | Rôle | Contenu | Empreinte |
|---|---|---|---|
| `data/signes_graves_v2.jsonl` | Développement : sert à corriger le prompt et le lexique | 110 messages : 80 avec au moins un signe grave (11 à 15 par signe), 30 négatifs | `6e1a24d6…a0eb` |
| `data/signes_graves_controle.jsonl` | Contrôle : écrit avant d'avoir vu les erreurs, mesuré **une seule fois** à la fin, sans correction ensuite | 70 messages : 49 avec un signe grave (7 par signe), 21 négatifs | `888ced64…180d` |

Les négatifs contiennent des négations (« pas de sang dans les selles ») et des pièges (« j'ai donné mon sang », « mourir de rire », essoufflement bref après le sport, cou raide à cause de l'oreiller).

Indicateurs : rappel par signe, **alerte ratée** (message grave pour lequel aucun signe n'est détecté : le triage ne passe pas en alerte), **fausse alerte** (message négatif qui déclenche un signe).

## Ce qui a changé

- **Prompt `extraction-v2`** (`backend/src/ia/extraction.json`, archivé dans `ia/prompts/`) : chaque signe grave est décrit par familles d'expressions ; « nuque raide avec fièvre » => confusion ; contextes bénins listés ; « je n'arrive plus à respirer » rappelé comme signe grave et non comme négation.
- **Lexique v2** (`backend/src/ia/signes-graves.ts`) : vocabulaire élargi et correction d'un défaut du lexique v1, qui lisait « je n'arrive plus à respirer » ou « je n'ai plus envie de vivre » comme des négations.
- **Union en production** (`backend/src/ia/voice-triage.service.ts`) : les signes trouvés par le lexique s'ajoutent à ceux de Gemini, pour les notes en français.

## Résultats sur le jeu de contrôle (mesure finale)

| Méthode | Alertes ratées | Fausses alertes | Signe le plus faible |
|---|---|---|---|
| Lexique v1 (référence d'origine) | 34/49 | 7/21 | confusion et vomit_traitement : 0/7 |
| **Gemini, prompt v1 (production jusqu'ici)** | **4/49** | 2/21 | confusion et saignement : 5/7 |
| Lexique v2 seul | 2/49 | 1/21 | respiration, confusion, vomit_traitement : 6/7 |
| Gemini, prompt v2 seul | 2/49 | 0/21 | confusion et saignement : 6/7 |
| **Union Gemini v2 + lexique v2 (nouvelle production)** | **0/49** | **1/21** | confusion : 6/7 |

Rappel par signe de l'union sur le contrôle : respiration 7/7, poitrine 7/7, confusion 6/7, vomit_traitement 7/7, saignement 7/7, malaise 7/7, idées noires 7/7.

Erreurs restantes de l'union :
- **confusion manquée** : « je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque » (raideur de nuque décrite sans fièvre ni maux de tête). Le message déclenche tout de même l'alerte, via le signe « poitrine » coché à tort ;
- **faux positifs** : « respiration » pour une douleur thoracique en respirant ; « vomit_traitement » pour « je garde bien mes comprimés, aucun vomissement ».

Sur le jeu de développement (optimiste, puisqu'il a servi à corriger) : Gemini v1 7/80 alertes ratées ; union 0/80, 0/30 fausse alerte.

## Limites

- **Messages fictifs écrits par l'équipe**, y compris le jeu de contrôle : même s'il a été figé avant toute correction, son vocabulaire ressemble à celui des auteurs du lexique. Le chiffre réel sera moins bon.
- **7 cas par signe** sur le contrôle : l'intervalle de confiance est large. Avec 7/7, le rappel réel peut encore descendre vers 59 % (borne basse exacte de Clopper-Pearson à 95 %). Le critère de l'audit (≥ 95 % par signe sur au moins 20 cas) n'est donc pas encore démontré.
- **Texte seulement** : mesuré sur l'entrée texte de Gemini ; en production, le texte vient de la transcription ElevenLabs.
- **Français seulement** : le fon reste exclu de l'analyse vocale.

## Refaire la mesure

```
cd backend
npx tsx scripts/evaluer-signes-graves.ts union controle
VERSION_PROMPT=v1 npx tsx scripts/evaluer-signes-graves.ts gemini controle
```

Les réponses brutes de Gemini sont gardées dans `ia/resultats/signes_graves_*__gemini__extraction-v*.jsonl` (le script ne rappelle pas l'API si elles existent), les rapports dans `ia/resultats/signes_graves_*.md`. Le fichier `signes_graves_v2__mots-cles__extraction-v1.md` contient la mesure du lexique v2 sur le jeu de développement (étiquette de prompt sans effet pour cette variante).
