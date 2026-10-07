# VIHEPAT : la fonction IA « note vocale → priorité d'alerte »

## 1. Ce que fait la fonction

Le patient enregistre une note vocale dans le formulaire « Comment vous sentez-vous ? ». En appuyant sur **Analyser ma note vocale** :

```
 Navigateur (MediaRecorder, WebM/Opus)
      │  base64, ~30 Ko pour 15 s
      ▼
 POST /api/patients/me/triage-vocal          (JWT patient, 20 req / 15 min, 5 Mo max)
      │
      ▼
 Gemini (1 seul appel) : transcription + extraction        backend/src/ia/gemini.client.ts
      │  JSON contraint par un schéma à listes fermées     backend/src/ia/extraction.json
      ▼
 Validation zod (rejet si hors schéma)                     backend/src/ia/voice-triage.service.ts
      ▼
 Moteur de règles déterministe → banal / à surveiller / alerte + raisons     backend/src/ia/triage.ts
      ▼
 Formulaire PRÉ-REMPLI : le patient voit la transcription, corrige, puis envoie
 (la priorité finale est recalculée sur l'appareil au moment de l'envoi)
```

**Le LLM ne décide jamais de la priorité.** Il transforme une parole libre en champs fermés ; la décision est prise par les mêmes règles que le triage hors ligne (`frontend/src/lib/triage.ts`, copie identique côté serveur, vérifiée par `npm run ia:sync-triage`). Conséquences : chaque alerte est expliquée (« fièvre depuis plus d'une semaine »), testable, et le comportement reste le même avec ou sans réseau.

Essai sans base de données : `cd backend && npm run ia:audio -- note.wav`.

Le chatbot a aussi un bouton micro : `POST /api/chat/transcrire` (prompt `backend/src/ia/transcription.json`, ouvert aux visiteurs, 15 notes / 15 min) renvoie le texte, que la personne relit dans la zone de saisie avant d'envoyer. Aucun texte n'est renvoyé si la note est en fon.

## 2. Le prompt

Fichier unique : `backend/src/ia/extraction.json` (version `extraction-v1`), lu à la fois par l'API et par le notebook d'évaluation : ce qui est mesuré est exactement ce qui tourne.

**Structure**
| Partie | Contenu | Pourquoi |
|---|---|---|
| Instruction système | rôle : « module d'extraction », pas assistant ni médecin | réduit les réponses hors sujet et les diagnostics |
| 6 règles strictes | ne rien inventer ; respecter les négations ; signes de gravité même indirects ; définitions de la durée et de l'intensité **identiques aux boutons de l'application** ; « autre » + précision ; aucun diagnostic | les erreurs dangereuses (négation ratée, urgence indirecte) sont nommées explicitement |
| Lexique local | « corps chaud » → fièvre, « ventre qui coule » → diarrhée, « je rends mes comprimés » → vomit_traitement… | français parlé au Bénin |
| Message utilisateur | audio en `inlineData` + consigne de transcription mot à mot ; ou texte | un seul appel pour transcrire et structurer |

**Paramètres**
| Paramètre | Valeur | Raison |
|---|---|---|
| `temperature` | 0 | extraction, pas de créativité ; réponses aussi stables que possible |
| `responseMimeType` | `application/json` | sortie analysable |
| `responseSchema` | objet à énumérations fermées (12 symptômes, 3+1 durées, 3+1 intensités, 7 signes de gravité) | le modèle ne peut pas produire de catégorie inconnue ; `inconnue` évite d'inventer une durée |
| exemples | aucun (zero-shot) | pas de fuite entre prompt et jeu de test |
| modèle | `gemini-3.5-flash-lite`, secours `gemini-3.8-flash` | versions fixées (jamais d'alias « latest »). Choix mesuré le 05/10/2026 : Flash-Lite a traité tous les messages de l'évaluation (quelques refus 429 de quota par minute, résolus en espaçant les appels), Flash aucun (surcharge 503, puis quota gratuit de 20 requêtes/jour épuisé) ; taux exacts dans `ia/RESULTATS.md` |

Le prompt a été figé avant la première exécution sur le jeu d'évaluation. Toute nouvelle version doit changer le champ `version` et être réévaluée par le notebook.

## 3. Gestion des erreurs

| Situation | Comportement | Ce que voit le patient |
|---|---|---|
| Pas de clé `GEMINI_API_KEY` | 503 `non_configure`, aucun appel | le bouton échoue proprement, formulaire manuel |
| Modèle principal surchargé (429/5xx) ou > 20 s | **bascule automatique** sur le modèle de secours (1 seul essai de plus) | rien, la réponse arrive un peu plus tard |
| Les deux modèles échouent | 502 / 504 avec un code | « L'analyse automatique n'a pas marché. Remplissez simplement le formulaire. » |
| Réponse vide, bloquée, JSON illisible ou hors schéma | rejet (zod), 502 | idem |
| Note en fon ou autre langue (`utilisable: false`) | extraction ignorée, rien n'est pré-rempli | « Je ne comprends pas encore bien le fon à l'oral… » + pictogrammes |
| Hors ligne | le bouton n'est pas proposé | triage embarqué, signalement mis en file d'attente |
| Audio > 5 Mo / type non audio | 413 / 400 | message d'erreur |
| Abus | rate limit 20 analyses / 15 min / IP | message « réessayez dans quelques minutes » |

Chaque appel ajoute une ligne à `backend/logs/ia-mesures.jsonl` (modèle servi, latence, tokens, nombre de tentatives, niveau) **sans identifiant ni contenu de santé** : c'est la latence mesurée en conditions réelles.

## 4. Évaluation, latence et coût

Méthode et chiffres : notebook `ia/VIHEPAT_evaluation_IA.ipynb`, résumé dans `ia/RESULTATS.md`.

Mesures du 05/10/2026, prompt `extraction-v1`, 165 messages fictifs annotés (70 alerte, 46 à surveiller, 49 banal) et 42 notes audio de synthèse. Tous les chiffres viennent de l'exécution du notebook (réponses brutes dans `ia/resultats/`).

**Priorité d'alerte (165 messages, IC 95 % par bootstrap)**

| Méthode | Exactitude | Rappel des alertes | Sous-triage (dangereux) | Sur-triage |
|---|---|---|---|---|
| A · mots-clés + règles | 0,867 [0,81–0,92] | 0,871 | 0,073 | 0,061 |
| B · TF-IDF + régression logistique (CV 5 plis) | 0,667 [0,59–0,74] | 0,771 | 0,145 | 0,188 |
| **C · Gemini 3.5 Flash-Lite + règles** | **0,945 [0,91–0,98]** | **0,957** | **0,024** | 0,030 |

- C vs A : C est seul juste sur 20 messages, A sur 7 ; McNemar exact p = 0,019. C vs B : p < 0,0001.
- Le gain de C vient surtout des **négations** (1,00 contre 0,86 pour A), du **langage familier** (0,90 contre 0,80) et des **messages bruités** (0,93 contre 0,67).
- Le modèle A est avantagé : son lexique a été écrit en connaissant les messages. Son score est un plafond optimiste.
- **Sous-triages de C (4/165)** : 2 saignements (« sang dans mes selles », « règles qui coulent comme jamais ») et une « nuque raide » classés en « autre », une intensité « fort » lue « gêne ». Rappel des signes de gravité par signe : respiration 8/8, idées noires 6/6, saignement 4/6, confusion 5/6.
- Gemini 3.8 Flash n'a pas pu être évalué : 0 réponse sur 63 appels (8 surcharges 503 et 55 refus 429 : quota gratuit de **20 requêtes par jour**). Il reste configuré seulement en secours.

**Voix (42 notes, voix de synthèse fr-FR, WebM/Opus)**
- Taux d'erreur de mots de la transcription (WER) : **4,9 %**.
- Exactitude du niveau à partir de l'audio : 0,952, identique au texte sur les mêmes messages ; sous-triage 0,024.

**Latence mesurée (depuis le PC de l'équipe, réseau compris)**
| Entrée | Médiane | 95e centile |
|---|---|---|
| Texte | 2,5 s | 3,8 s |
| Audio | 3,5 s | 32,2 s (quelques réponses très lentes : d'où le délai de 20 s puis la bascule de secours dans l'API) |
| Mots-clés / TF-IDF (local) | moins de 3 ms (varie selon les exécutions) | — |

**Coût** (prix officiels relevés le 05/10/2026 : Flash-Lite 0,30 $ / M tokens en entrée, 2,50 $ / M en sortie) : ~544 tokens en entrée et ~104 en sortie par message, soit **0,42 $ pour 1 000 messages texte** et **0,44 $ pour 1 000 notes vocales**. Le palier gratuit suffit pour une démonstration, mais pas pour la production (confidentialité, voir `ETHIQUE.md`).

**Le fon (vraies voix, 1 locuteur, 9 notes « alerte », 06-07/10/2026)**

| Méthode | Bien classées | Pour la bonne raison | Alertes ratées |
|---|---|---|---|
| Gemini seul (audio fon) | 0 / 9 | 0 | 9 |
| MMS (reconnaissance fon) + NLLB-200 600M (traduction) + Gemini + règles | 3 / 9 | 2 | 6 |
| Les mêmes messages dits en français, Gemini seul | 9 / 9 | 9 | 0 |

- Gemini **reconnaît** le fon (9/9 détectés « fon ») mais ne le **comprend** pas : transcriptions inventées.
- Avec MMS + NLLB (notebook `ia/VIHEPAT_fon_MMS_NLLB.ipynb`, Colab GPU, ~0,3 s MMS + 1 à 3 s NLLB par note), le texte fon produit par MMS paraît plausible (à faire valider par un locuteur), mais **la traduction est le maillon faible** : phrases inventées au registre biblique (« élevé dans la montagne », « airain »), probablement héritées des données d'entraînement de ces modèles.
- Conséquence dans l'application : une note détectée en fon n'est **jamais** utilisée (pas de pré-remplissage, pas de texte dans le chat) ; le patient passe par les pictogrammes. 6 alertes ratées sur 9 seraient dangereuses.
- Suite prévue : NLLB 1,3 et 3,3 milliards de paramètres (déjà prévus dans le notebook), relecture des sorties MMS par un locuteur, plus de notes et de locuteurs.

**Piste d'amélioration (non évaluée)** : ajouter les signes de gravité détectés par les mots-clés à ceux de Gemini (union), puisque les deux méthodes ne ratent pas les mêmes. Ce réglage a été imaginé après lecture des erreurs : il devra être mesuré sur de **nouveaux** messages pour ne pas sur-ajuster au jeu de test.

## 5. Éthique

Voir `docs/ETHIQUE.md`.
