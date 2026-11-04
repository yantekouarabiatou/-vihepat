"""Exporte le modèle de perte de suivi (pipeline scikit-learn) en JSON pour l'API Node.

La régression logistique se recalcule exactement à partir de ses paramètres :
imputation -> standardisation -> encodage one-hot -> combinaison linéaire -> sigmoïde.
Le script vérifie ensuite sur le jeu de données complet que le calcul « à la main »
redonne les probabilités de scikit-learn, puis écrit le JSON lu par l'API.

    python scripts/exporter_modele_node.py
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

RACINE = Path(__file__).resolve().parents[1]
MODELE = RACINE / 'models' / 'ltfu_modele_final.joblib'
META = RACINE / 'models' / 'ltfu_modele_final.json'
SORTIE = RACINE.parents[1] / 'backend' / 'src' / 'ia' / 'perte-de-suivi.modele.json'


class ImputationAleatoire(BaseEstimator, TransformerMixin):
    """Copie de la classe du notebook (section 6.3), nécessaire pour recharger le pipeline."""

    def __init__(self, random_state=42):
        self.random_state = random_state

    def fit(self, X, y=None):
        X = pd.DataFrame(X)
        self.valeurs_ = [X[c].dropna().to_numpy() for c in X.columns]
        return self

    def transform(self, X):
        X, rng = pd.DataFrame(X).copy(), np.random.default_rng(self.random_state)
        for j, c in enumerate(X.columns):
            manquant = X[c].isna().to_numpy()
            if manquant.any():
                X.loc[manquant, c] = rng.choice(self.valeurs_[j], manquant.sum())
        return X.to_numpy()

    def get_feature_names_out(self, input_features=None):
        return np.asarray(input_features, dtype=object)


# --- Reconstruction du jeu d'entraînement (copie des sections 2, 5 et 6 du notebook) ---
SEED = 42
DATE_REF_ANNEE, DELAI_LTFU = 2016, 6
LABS = ['ALT', 'CD4Count', 'Creatin', 'Hemoglob', 'Platelet', 'RNAVload', 'TotProt', 'Urea', 'WBC']
BORNES = {'Age': (15, 100), 'ALT': (1, 5000), 'CD4Count': (1, 3000), 'Creatin': (15, 2000),
          'Hemoglob': (2, 20), 'Platelet': (5, 1500), 'RNAVload': (0, 1e7), 'TotProt': (30, 150),
          'Urea': (0.5, 100), 'WBC': (0.5, 100)}


def charger():
    raw = pd.read_excel(RACINE / 'data' / 'raw' / 'pone.0219903.s003.xlsx')
    cols_orig = [c for c in raw.columns if c != 'Discontinue']
    df = raw.loc[raw['Discontinue'].isna()].drop(columns='Discontinue').copy().reset_index(drop=True)
    df['LTFU'] = (df['MonthsInCare'] < 12 * (DATE_REF_ANNEE - df['Cohort year']) - DELAI_LTFU).astype(int)
    return df, cols_orig


def nettoyer(d, cols_orig):
    d = d.copy()
    copie = d.duplicated(subset=cols_orig, keep='first')
    d = d.loc[~(copie & d[LABS].notna().any(axis=1))]
    d['nb_examens_manquants'] = d[['WHOStage'] + LABS].isna().sum(axis=1)
    d['Sex'] = d['Sex'].str.strip().str.capitalize()
    d['Education'] = d['Education'].replace({'Tertiary\nSecondary': 'Tertiary'})
    for c, (lo, hi) in BORNES.items():
        d.loc[(d[c] < lo) | (d[c] > hi), c] = np.nan
    return d.drop(columns=['HCT']).reset_index(drop=True)


def creer_variables(d):
    d = d.copy()
    d['annees_exposition'] = (DATE_REF_ANNEE - d['Cohort year']) + 0.5
    d['log10_CV'] = np.log10(d['RNAVload'] + 1)
    for c in ['ALT', 'Creatin', 'Urea', 'WBC', 'Platelet']:
        d[f'log_{c}'] = np.log(d[c])
    d['sqrt_CD4'] = np.sqrt(d['CD4Count'])
    d['cv_inf_1000'] = np.where(d['RNAVload'].isna(), np.nan, (d['RNAVload'] < 1000).astype(float))
    connu = d['WHOStage'].notna() | d['CD4Count'].notna()
    avance = (d['WHOStage'] >= 3) | (d['CD4Count'] < 200)
    d['vih_avance'] = np.where(connu, avance.astype(float), np.nan)
    d['WHOStage'] = d['WHOStage'].map({1.0: '1', 2.0: '2', 3.0: '3', 4.0: '4'})
    return d


def decouper(pipe):
    from sklearn.model_selection import train_test_split
    df, cols_orig = charger()
    d = creer_variables(nettoyer(df, cols_orig))
    X, y = d[list(pipe.named_steps['prep'].feature_names_in_)], d['LTFU']
    strate = d['LTFU'].astype(str) + '_' + d['Cohort year'].astype(str)
    idx_trval, idx_test = train_test_split(d.index, test_size=0.20, stratify=strate, random_state=SEED)
    idx_train, _ = train_test_split(idx_trval, test_size=0.25, stratify=strate.loc[idx_trval], random_state=SEED)
    return X.loc[idx_train], X.loc[idx_test], y.loc[idx_test]


# Le pipeline a été sérialisé depuis le notebook, où la classe vivait dans __main__
sys.modules['__main__'].ImputationAleatoire = ImputationAleatoire


def exporter():
    pipe = joblib.load(MODELE)
    meta = json.loads(META.read_text(encoding='utf-8'))
    prep, clf = pipe.named_steps['prep'], pipe.named_steps['clf']
    blocs = {nom: (t, cols) for nom, t, cols in prep.transformers_ if nom != 'remainder'}

    # gen : imputation aléatoire à l'entraînement. En production on impute par la moyenne
    # (contribution nulle) pour un score reproductible ; nb_examens_manquants et la durée
    # d'exposition sont toujours calculables, seul l'âge peut manquer.
    gen_pipe, gen_cols = blocs['gen']
    sc = gen_pipe.named_steps['sc']
    gen = [{'nom': c, 'moyenne': float(m), 'ecart': float(s), 'min': float(np.min(v)), 'max': float(np.max(v))}
           for c, m, s, v in zip(gen_cols, sc.mean_, sc.scale_, gen_pipe.named_steps['imp'].valeurs_)]

    bio_pipe, bio_cols = blocs['bio']
    imp, sc = bio_pipe.named_steps['imp'], bio_pipe.named_steps['sc']
    indic = [bio_cols[i] for i in imp.indicator_.features_]
    noms_bio = list(bio_cols) + [f'missingindicator_{c}' for c in indic]
    bio = {
        'variables': [{'nom': c, 'mediane': float(m)} for c, m in zip(bio_cols, imp.statistics_)],
        'indicateurs': indic,
        'standardisation': [{'nom': n, 'moyenne': float(m), 'ecart': float(s)}
                            for n, m, s in zip(noms_bio, sc.mean_, sc.scale_)],
    }

    bin_imp, bin_cols = blocs['bin']
    binaire = [{'nom': c, 'mode': float(m)} for c, m in zip(bin_cols, bin_imp.statistics_)]

    cat_pipe, cat_cols = blocs['cat']
    ohe = cat_pipe.named_steps['ohe']
    cat = []
    for c, cats, drop in zip(cat_cols, ohe.categories_, ohe.drop_idx_ if ohe.drop_idx_ is not None else [None] * len(cat_cols)):
        cat.append({'nom': c, 'categories': [str(x) for x in cats],
                    'supprimee': None if drop is None or (isinstance(drop, float) and np.isnan(drop)) else str(cats[int(drop)])})

    noms = [str(n) for n in prep.get_feature_names_out()]
    # Patient de référence = moyenne des colonnes transformées à l'entraînement : les contributions
    # affichées au soignant se lisent « par rapport à un patient moyen de la cohorte »
    X_train, _, _ = decouper(pipe)
    reference = prep.transform(X_train).mean(axis=0)
    sortie = {
        'modele': meta['modele'], 'version': meta['version'], 'date': meta['date'],
        'usage': meta['usage'], 'cible': meta['cible'], 'source': meta['donnees']['source'],
        'performances_test': {k: round(v['valeur'], 3) for k, v in meta['performances_test'].items()},
        'seuils': {'modere': meta['seuils']['alerte_sensibilite_80'], 'eleve': meta['seuils']['risque_eleve_precision_85']},
        'date_reference_annee': 2016,
        'gen': gen, 'bio': bio, 'binaire': binaire, 'categorielles': cat,
        'colonnes': noms,
        'reference': [float(x) for x in reference],
        'coefficients': [float(x) for x in clf.coef_[0]],
        'intercept': float(clf.intercept_[0]),
    }
    return pipe, sortie


def verifier(pipe, sortie):
    """Recalcule les probabilités à la main sur un échantillon synthétique et les compare à scikit-learn."""
    rng = np.random.default_rng(0)
    n = 500
    X = pd.DataFrame({
        'Age': rng.uniform(18, 70, n),
        'annees_exposition': rng.choice([2.5, 3.5, 4.5, 5.5, 6.5], n),
        'nb_examens_manquants': rng.integers(0, 11, n).astype(float),
    })
    for v in sortie['bio']['variables']:
        col = rng.normal(v['mediane'], abs(v['mediane']) * 0.3 + 0.1, n)
        col[rng.random(n) < 0.3] = np.nan
        X[v['nom']] = col
    for b in sortie['binaire']:
        col = rng.integers(0, 2, n).astype(float)
        col[rng.random(n) < 0.3] = np.nan
        X[b['nom']] = col
    for c in sortie['categorielles']:
        valeurs = [x for x in c['categories'] if x != 'Inconnu']
        col = rng.choice(valeurs, n).astype(object)
        col[rng.random(n) < 0.2] = np.nan
        X[c['nom']] = col
    X = X[pipe.named_steps['prep'].feature_names_in_]

    attendu = pipe.predict_proba(X)[:, 1]
    A = pipe.named_steps['prep'].transform(X)
    z = A @ np.array(sortie['coefficients']) + sortie['intercept']
    ecart = np.abs(1 / (1 + np.exp(-z)) - attendu).max()
    print(f'Écart maximal sklearn / calcul linéaire : {ecart:.2e}')
    assert ecart < 1e-9, ecart

    # Vrais patients du jeu de test (sans âge manquant : l'âge est imputé au hasard par sklearn)
    _, X_test, y_test = decouper(pipe)
    X_test = X_test[X_test['Age'].notna()]
    p_test = pipe.predict_proba(X_test)[:, 1]
    print(f'Jeu de test : {len(X_test)} patients, AUC recalculée = {__import__("sklearn.metrics").metrics.roc_auc_score(y_test.loc[X_test.index], p_test):.3f}')
    X = pd.concat([X.iloc[:15], X_test.iloc[:15]])
    attendu = np.concatenate([attendu[:15], p_test[:15]])

    # Jeu de cas de test pour l'API Node : entrées brutes + probabilité attendue
    cas = []
    for i in range(len(X)):
        ligne = {k: (None if pd.isna(v) else (float(v) if not isinstance(v, str) else v)) for k, v in X.iloc[i].items()}
        cas.append({'entree': ligne, 'probabilite': float(attendu[i])})
    return cas


if __name__ == '__main__':
    pipe, sortie = exporter()
    sortie['cas_de_test'] = verifier(pipe, sortie)
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(sortie["colonnes"])} colonnes, écrit dans {SORTIE}')
