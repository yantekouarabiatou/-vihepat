# Modèle 1 : risque de perte de suivi (LTFU)

**Question** : quel patient risque de sortir du parcours de soins ?
**Usage dans VIHEPAT** : score de priorisation dans l'espace soignant. *Le score priorise, le soignant décide.*

Notebook : [`notebooks/01_modele_perte_de_suivi_LUTH.ipynb`](notebooks/01_modele_perte_de_suivi_LUTH.ipynb)

## Résultats en bref

| | |
|---|---|
| **Données** | 6 108 patients VIH inclus en 2010-2014 au Lagos University Teaching Hospital ; cible reconstruite : **3 400 perdus de vue** (article : 3 397) |
| **Modèle retenu** | **Régression logistique**. XGBoost, Random Forest et le MLP ne font pas significativement mieux (bootstrap apparié), donc la règle de parcimonie s'applique |
| **Test (n = 1 219, IC 95 %)** | ROC-AUC **0,765** [0,738-0,789] · PR-AUC **0,817** [0,790-0,844] · sensibilité **81 %** · VPP **69 %** |
| **Priorisation** | Parmi les 20 % de patients les plus à risque, 89 % sont réellement perdus de vue (1,6 fois mieux que le hasard) |
| **Niveaux affichés** | faible : 31 % de LTFU observés · modéré : 60 % · élevé : 88 % |
| **Enseignement clé** | Le signal le plus fort est un **bilan d'inclusion incomplet**. Les variables cliniques seules plafonnent à une AUC de 0,62, d'où l'intérêt pour VIHEPAT de suivre l'engagement du patient en continu |

**Limites principales** : données nigérianes anciennes et monocentriques (recalibration sur données béninoises indispensable), étiquette « perdu de vue » bruitée (décès et transferts non déclarés), forte dépendance à la complétude des dossiers. Le détail figure dans les sections 14 et 15 du notebook.

## Reproduire

Prérequis : Python 3.10 ou plus récent.

```bash
cd ia/perte_de_suivi
pip install -r requirements.txt
jupyter nbconvert --to notebook --execute --inplace notebooks/01_modele_perte_de_suivi_LUTH.ipynb
```

* Si `data/raw/` est vide, le jeu de données est **téléchargé automatiquement**, puis son empreinte SHA-256 est vérifiée.
* Toutes les sources d'aléa sont fixées (`SEED = 42`) : deux exécutions donnent exactement les mêmes résultats.
* Durée : environ 4 minutes sur un ordinateur portable à 12 cœurs.
* Sur Google Colab : téléverser le notebook, exécuter `!pip install lifelines`, puis *Exécution > Tout exécuter*.

## Contenu

| Chemin | Rôle |
|---|---|
| `notebooks/01_modele_perte_de_suivi_LUTH.ipynb` | Livrable principal : données → EDA → préparation → 5 modèles + Cox → évaluation → explicabilité → limites |
| `data/raw/pone.0219903.s003.xlsx` | Données sources, non modifiées (S3 de l'article, licence CC BY 4.0) |
| `figures/` | 25 figures exportées par le notebook, pour la présentation orale |
| `models/ltfu_modele_final.joblib` | Pipeline complet (prétraitement + régression logistique) |
| `models/ltfu_modele_final.json` | Métadonnées : variables attendues, seuils, performances, version des données |
| `reports/journal_experiences.csv` | Journal de bord des expérimentations |
| `reports/metriques_modeles.csv` | Métriques de tous les modèles (validation et test) |

**Recharger le modèle** : le pipeline attend les variables produites par `nettoyer()` puis `creer_variables()` (sections 5.1 et 5.2). La classe `ImputationAleatoire` (section 6.3) doit être importable au moment du `joblib.load`.

## Démarche

1. **Données** : téléchargement depuis l'éditeur (PLOS), contrôle d'intégrité, licence CC BY 4.0.
2. **Construction de la cible** : le fichier ne contient pas de colonne « perdu de vue ». Elle est reconstruite à partir de la définition de l'article (≥ 6 mois sans service au 31/12/2016), puis validée sur l'effectif publié et sur les patients tracés.
3. **Audit des fuites de données** : les variables de fin de suivi sont exclues (avec elles, l'AUC atteint artificiellement 0,93).
4. **EDA** : valeurs manquantes informatives, doublons, valeurs impossibles, déséquilibre, histogrammes, box plots, corrélations, dispersions, courbes de Kaplan-Meier.
5. **Préparation** : nettoyage déterministe, variables cliniques justifiées (VIH avancé OMS, charge virale en log10, complétude du bilan), découpage stratifié 60/20/20.
6. **Modélisation** : référence naïve, régression logistique, Random Forest, XGBoost, MLP et modèle de Cox. Hyperparamètres choisis par validation croisée, courbes de perte par epoch.
7. **Sélection** selon une règle fixée à l'avance (PR-AUC et bootstrap apparié), puis choix du seuil sur la validation.
8. **Évaluation finale** sur le test : intervalles de confiance, calibration, courbe de décision, rappel selon la capacité de relance.
9. **Explicabilité** (odds ratios, SHAP, permutation) et carte patient telle qu'affichée dans VIHEPAT.
10. **Analyse des erreurs**, **équité**, **analyses de sensibilité**, **limites** et **pistes d'amélioration**.

## Source des données

Balogun M., Meloni S.T., Igwilo U.U. *et al.* (2019). Status of HIV-infected patients classified as lost to follow up from a large antiretroviral program in southwest Nigeria. *PLoS ONE* 14(7): e0219903. [doi:10.1371/journal.pone.0219903](https://doi.org/10.1371/journal.pone.0219903). Données S3, licence CC BY 4.0.
