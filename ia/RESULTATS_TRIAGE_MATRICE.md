# Triage : matrice de confusion et métriques par classe

Jeu : 165 messages fictifs (banal 49, à surveiller 46, alerte 70). Lignes = niveau attendu, colonnes = niveau prédit. Généré par `ia/scripts/matrice_triage.py`.

## C · Gemini 3.5 Flash-Lite + règles (prompt v1)

165 messages évalués.

| attendu \ prédit | banal | à surveiller | alerte |
|---|---|---|---|
| **banal** | 45 | 2 | 2 |
| **à surveiller** | 1 | 44 | 1 |
| **alerte** | 1 | 2 | 67 |

| Classe | Précision | Rappel | F1 | Effectif |
|---|---|---|---|---|
| banal | 0.957 | 0.918 | 0.938 | 49 |
| à surveiller | 0.917 | 0.957 | 0.936 | 46 |
| alerte | 0.957 | 0.957 | 0.957 | 70 |

Exactitude 0.945 · F1 macro 0.944 · sous-triage 0.024 (dont alerte classée banal : 1)

## A · mots-clés + règles

165 messages évalués.

| attendu \ prédit | banal | à surveiller | alerte |
|---|---|---|---|
| **banal** | 41 | 5 | 3 |
| **à surveiller** | 3 | 41 | 2 |
| **alerte** | 3 | 6 | 61 |

| Classe | Précision | Rappel | F1 | Effectif |
|---|---|---|---|---|
| banal | 0.872 | 0.837 | 0.854 | 49 |
| à surveiller | 0.788 | 0.891 | 0.837 | 46 |
| alerte | 0.924 | 0.871 | 0.897 | 70 |

Exactitude 0.867 · F1 macro 0.863 · sous-triage 0.073 (dont alerte classée banal : 3)

## Référence triviale « toujours alerte »

165 messages évalués.

| attendu \ prédit | banal | à surveiller | alerte |
|---|---|---|---|
| **banal** | 0 | 0 | 49 |
| **à surveiller** | 0 | 0 | 46 |
| **alerte** | 0 | 0 | 70 |

| Classe | Précision | Rappel | F1 | Effectif |
|---|---|---|---|---|
| banal | 0.000 | 0.000 | 0.000 | 49 |
| à surveiller | 0.000 | 0.000 | 0.000 | 46 |
| alerte | 0.424 | 1.000 | 0.596 | 70 |

Exactitude 0.424 · F1 macro 0.199 · sous-triage 0.000 (dont alerte classée banal : 0)

## Référence triviale « classe majoritaire » (alerte)

165 messages évalués.

| attendu \ prédit | banal | à surveiller | alerte |
|---|---|---|---|
| **banal** | 0 | 0 | 49 |
| **à surveiller** | 0 | 0 | 46 |
| **alerte** | 0 | 0 | 70 |

| Classe | Précision | Rappel | F1 | Effectif |
|---|---|---|---|---|
| banal | 0.000 | 0.000 | 0.000 | 49 |
| à surveiller | 0.000 | 0.000 | 0.000 | 46 |
| alerte | 0.424 | 1.000 | 0.596 | 70 |

Exactitude 0.424 · F1 macro 0.199 · sous-triage 0.000 (dont alerte classée banal : 0)

