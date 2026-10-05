# Résultats de l'évaluation (généré le 05/10/2026 16:53 par le notebook)

Jeu : 165 messages fictifs ({'banal': 49, 'a_surveiller': 46, 'alerte': 70}), 165 évalués pour les modèles A · mots-clés, B · TF-IDF, C · Gemini Flash-Lite. Prompt `extraction-v1`.

## Priorité d'alerte (IC 95 % bootstrap)

|                       | exactitude        | F1 macro          | rappel alerte     | sous-triage       | sur-triage        | kappa pondéré     |
|:----------------------|:------------------|:------------------|:------------------|:------------------|:------------------|:------------------|
| A · mots-clés         | 0.867 [0.81–0.92] | 0.863 [0.80–0.91] | 0.871 [0.79–0.94] | 0.073 [0.04–0.12] | 0.061 [0.02–0.10] | 0.824 [0.72–0.90] |
| B · TF-IDF            | 0.667 [0.59–0.74] | 0.651 [0.57–0.72] | 0.771 [0.67–0.87] | 0.145 [0.09–0.21] | 0.188 [0.13–0.25] | 0.668 [0.55–0.76] |
| C · Gemini Flash-Lite | 0.945 [0.91–0.98] | 0.944 [0.91–0.98] | 0.957 [0.91–1.00] | 0.024 [0.01–0.05] | 0.030 [0.01–0.06] | 0.922 [0.85–0.98] |

## Fiabilité de l'API pendant la mesure

| modèle                | version servie        |   appels |   réussis |   taux de réussite par appel | messages couverts   | erreurs                         | dernier message d'erreur                                                                                       |
|:----------------------|:----------------------|---------:|----------:|-----------------------------:|:--------------------|:--------------------------------|:---------------------------------------------------------------------------------------------------------------|
| gemini-3.5-flash-lite | gemini-3.5-flash-lite |      168 |       165 |                        0.982 | 165/165             | {'http_429': 3}                 | You exceeded your current quota, please check your plan and billing details. For more information on this erro |
| gemini-3.8-flash      | aucune réponse        |       63 |         0 |                        0     | 0/165               | {'http_503': 8, 'http_429': 55} | You exceeded your current quota, please check your plan and billing details. For more information on this erro |

## Audio (voix de synthèse, 42 messages)

| modèle                | messages   |   taux réussite appel |   WER |   exactitude niveau (audio) |   même messages en texte |   sous-triage (audio) |   latence médiane (s) |   latence p95 (s) |   tokens audio moyens |
|:----------------------|:-----------|----------------------:|------:|----------------------------:|-------------------------:|----------------------:|----------------------:|------------------:|----------------------:|
| gemini-3.5-flash-lite | 42/42      |                 0.977 | 0.049 |                       0.952 |                    0.952 |                 0.024 |                  3.45 |             32.17 |                   124 |

## Vraies voix (fon, français accent béninois)

_pas encore d'enregistrements_

## Latence et coût

|                                    |   n |   latence médiane (s) |   p95 (s) |   tokens entrée |   tokens sortie |   tokens raisonnement |   coût / 1 000 notes ($) |
|:-----------------------------------|----:|----------------------:|----------:|----------------:|----------------:|----------------------:|-------------------------:|
| ('gemini-3.5-flash-lite', 'texte') | 165 |              2.48     |      3.83 |             544 |             104 |                     0 |                    0.422 |
| ('gemini-3.5-flash-lite', 'audio') |  42 |              3.45     |     32.17 |             655 |              98 |                     0 |                    0.443 |
| ('A · mots-clés', 'texte')         | 165 |              0.000488 |    nan    |             nan |             nan |                   nan |                    0     |
| ('B · TF-IDF', 'texte')            | 165 |              0.002436 |    nan    |             nan |             nan |                   nan |                    0     |

## Extraction champ par champ

| champ         |   A · mots-clés |   C · Gemini Flash-Lite |
|:--------------|----------------:|------------------------:|
| duree         |           0.933 |                   0.939 |
| intensite     |           0.927 |                   0.958 |
| signes_graves |           0.864 |                   0.894 |
| symptomes     |           0.939 |                   0.951 |