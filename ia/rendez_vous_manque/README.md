# Modèle 2 : risque de rendez-vous manqué

**Question** : quel patient risque de manquer son prochain rendez-vous ?
**Usage dans VIHEPAT** : graduer l'intensité des rappels (rappel standard, rappel renforcé, appel de confirmation). *Le score priorise, le soignant décide.*

Notebook : [`notebooks/02_modele_rendez_vous_manque_kaggle.ipynb`](notebooks/02_modele_rendez_vous_manque_kaggle.ipynb)

## Résultats en bref

| | |
|---|---|
| **Données** | 110 527 rendez-vous du jeu Kaggle *Medical Appointment No Shows* (Vitória, Brésil, avril-juin 2016) |
| **Population modélisée** | 71 955 rendez-vous **pris au moins la veille**, les seuls pour lesquels un rappel est possible ; 28,5 % d'absences |
| **Moment de la prédiction** | La veille du rendez-vous, avec l'historique de présence des jours précédents uniquement |
| **Modèle retenu** | **Régression logistique** avec splines (âge, délai). C'est la meilleure en validation temporelle ; Random Forest, XGBoost et le MLP ne font pas mieux |
| **Test (2 au 8 juin, IC 95 %)** | ROC-AUC **0,602** [0,590-0,613] · PR-AUC **0,342** [0,327-0,359] pour une prévalence de 0,261 |
| **Niveaux d'action** | faible : 21,0 % d'absents · modéré : 29,8 % · élevé : 37,6 %. Les 20 % de rendez-vous les plus à risque concentrent 28 % des absences |
| **Principaux facteurs** | Âge (pic vers 15-25 ans), délai de prise de rendez-vous, absences antérieures, précarité |
| **Enseignement clé** | Avec les seules variables administratives, l'absence reste difficile à prédire. Les courbes d'apprentissage montrent qu'il manque de l'**information**, pas des données : VIHEPAT doit collecter la confirmation des rappels, la distance et le motif de la visite |

**Pièges évités et chiffrés (section 14)** : un taux d'absence « du patient » calculé sur tous ses rendez-vous donne une AUC artificielle de 0,99 ; inclure les rendez-vous du jour même la gonfle à 0,74 sans aucune valeur pratique ; un découpage aléatoire aurait désigné XGBoost à tort.

**Limites principales** : signal faible, contexte brésilien et consultations générales (pas de suivi VIH), historique tronqué à 6 semaines, probabilités à recalibrer face à la dérive. Le détail figure dans les sections 15 et 16 du notebook.

## Reproduire

Prérequis : Python 3.10 ou plus récent.

```bash
cd ia/rendez_vous_manque
pip install -r requirements.txt
jupyter nbconvert --to notebook --execute --inplace notebooks/02_modele_rendez_vous_manque_kaggle.ipynb
```

* Si `data/raw/` est vide, le jeu de données est **téléchargé automatiquement** depuis l'API publique de Kaggle (aucun compte requis), puis l'empreinte SHA-256 du CSV est vérifiée.
* Toutes les sources d'aléa sont fixées (`SEED = 42`) : deux exécutions donnent les mêmes résultats.
* Durée : environ 10 minutes sur un ordinateur portable à 12 cœurs.
* Sur Google Colab : téléverser le notebook, exécuter `!pip install shap` si la bibliothèque est absente, puis *Exécution > Tout exécuter*. Les données sont téléchargées automatiquement.

## Contenu

| Chemin | Rôle |
|---|---|
| `notebooks/02_modele_rendez_vous_manque_kaggle.ipynb` | Livrable principal : données → EDA → préparation → 5 modèles → évaluation → explicabilité → limites |
| `data/raw/noshowappointments.zip` | Données sources non modifiées (`KaggleV2-May-2016.csv`), licence CC BY-NC-SA 4.0 |
| `figures/` | Figures exportées par le notebook, pour la présentation orale |
| `models/rdv_manque_modele_final.joblib` | Pipeline complet (prétraitement + régression logistique) |
| `models/rdv_manque_modele_final.json` | Métadonnées : variables attendues, seuils, performances, version des données |
| `reports/journal_experiences.csv` | Journal de bord des expérimentations |
| `reports/metriques_modeles.csv` | Métriques de tous les modèles (validation et test) |
| `reports/analyses_sensibilite.csv` | Résultats des 6 analyses de sensibilité |

**Recharger le modèle** : le pipeline attend les variables produites par `nettoyer()` puis `creer_variables()` (sections 4.4 et 5). `creer_variables()` doit recevoir **tous** les rendez-vous connus du patient pour reconstruire son historique. Aucune classe personnalisée n'est nécessaire pour le `joblib.load`.

## Démarche

1. **Données** : téléchargement depuis Kaggle, contrôle d'intégrité, licence.
2. **Définition du problème** : cible recodée (`No-show = Yes` signifie *absent*), prédiction la veille du rendez-vous, population des rendez-vous pris au moins la veille.
3. **Audit des fuites** : historique strictement antérieur, SMS exclu (circularité), quartier exclu (non transposable).
4. **Qualité des données** : doublons de session, âges et dates impossibles, codage du handicap.
5. **Variables** : délai, heure de prise, jour, historique de présence lissé, rendez-vous multiples le même jour.
6. **EDA** : déséquilibre, histogrammes, box plots, taux d'absence par facteur, paradoxe de Simpson sur les SMS, corrélations, nuages de points par quartier, évolution temporelle.
7. **Protocole** : découpage **temporel** (entraînement, validation, test), validation croisée et bootstrap **groupés par patient**, seuils fixés par la capacité de l'équipe.
8. **Modélisation** : référence naïve, régression logistique, Random Forest, XGBoost, MLP ; courbes de perte par epoch et courbes d'apprentissage.
9. **Évaluation** sur le test : intervalles de confiance, calibration, courbe de décision, rappel selon la capacité.
10. **Explicabilité** (courbes d'effet, odds ratios, SHAP, permutation), carte rendez-vous, **analyse des erreurs**, **équité**, **analyses de sensibilité**, **limites** et **pistes d'amélioration**.

## Source des données

Hoppen J. (2017). *Medical Appointment No Shows*, version 5. Kaggle. [kaggle.com/datasets/joniarroba/noshowappointments](https://www.kaggle.com/datasets/joniarroba/noshowappointments). Licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) : réutilisation non commerciale, avec citation, et partage des adaptations sous la même licence. Le modèle entraîné sur ces données est réservé à la démonstration.
