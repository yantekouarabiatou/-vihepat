"""Construit ia/VIHEPAT_evaluation_IA.ipynb (le notebook est généré pour rester relisible en revue de code).
   python ia/scripts/construire_notebook.py
Puis exécution : voir ia/README.md.
"""
from pathlib import Path

import nbformat as nbf

C = []
md = lambda s: C.append(nbf.v4.new_markdown_cell(s.strip()))
code = lambda s: C.append(nbf.v4.new_code_cell(s.strip()))

md(r"""
# VIHEPAT : évaluation de la chaîne « note vocale → priorité d'alerte »

**Question.** Le patient décrit ses symptômes à voix haute. Pour prévenir la bonne équipe au bon moment, l'application doit classer ce message en **banal / à surveiller / alerte**. Quelle méthode classe le mieux, et pour quel coût ?

**Ce que nous comparons** sur le même jeu de 165 messages :

| | Modèle | Ce qu'il fait | Propre à l'équipe ? |
|---|---|---|---|
| A | Mots-clés + règles | lexique + négations → champs → moteur de règles | oui, 100 % hors ligne |
| B | TF-IDF + régression logistique | apprend directement texte → niveau (validation croisée) | oui, entraîné ici |
| C | Gemini 3.5 Flash-Lite + règles | le LLM extrait les champs, **le moteur de règles décide** | prompt, schéma, évaluation |
| D | Gemini 3.8 Flash + règles | idem, modèle plus gros (avec raisonnement) | prompt, schéma, évaluation |

Choix de conception : Gemini **n'attribue jamais la priorité**. Il remplit un schéma JSON fermé ; le niveau est calculé par le moteur de règles déterministe de l'application (`frontend/src/lib/triage.ts`), le même qui tourne hors ligne sur le téléphone. Cela rend chaque décision explicable (« alerte : fièvre depuis plus d'une semaine ») et vérifiable.

**Métrique principale : le sous-triage** (prédire un niveau plus bas que le bon). C'est l'erreur dangereuse : une alerte classée « banal » n'est pas transmise en priorité. Le sur-triage coûte du temps soignant, pas une vie.

**Reproductibilité.** Toutes les réponses de Gemini sont enregistrées dans `ia/resultats/*.jsonl` (réponse brute, latence, tokens, version exacte du modèle, erreurs). Sans clé API, le notebook recalcule tous les chiffres à partir de ces fichiers ; avec une clé, il peut refaire les appels (`REFAIRE_APPELS = True`).
""")

md("## 0. Installation (Colab ou local)")
code(r"""
import sys, os, subprocess
from pathlib import Path

EN_COLAB = "google.colab" in sys.modules
DEPOT = "https://github.com/yantekouarabiatou/exact-screenshot.git"
BRANCHE = "feat/circuit-soignant"

if EN_COLAB and not Path("exact-screenshot").exists():
    subprocess.run(["git", "clone", "--depth", "1", "-b", BRANCHE, DEPOT], check=True)
IA = next(p for p in [Path.cwd(), Path.cwd() / "ia", Path("exact-screenshot/ia")] if (p / "vihepat_ia").exists()).resolve()
if EN_COLAB:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(IA / "requirements.txt")], check=True)
sys.path.insert(0, str(IA))

# Clé API : facultative (secrets Colab « GEMINI_API_KEY », ou variable d'environnement)
if EN_COLAB and not os.environ.get("GEMINI_API_KEY"):
    try:
        from google.colab import userdata
        os.environ["GEMINI_API_KEY"] = userdata.get("GEMINI_API_KEY")
    except Exception:
        pass
REFAIRE_APPELS = False  # True : complète / refait les appels manquants (coût réel, quelques centimes)
print("Dossier ia :", IA, "| clé API présente :", bool(os.environ.get("GEMINI_API_KEY")))
""")
code(r"""
import json, time, platform
import numpy as np, pandas as pd
import matplotlib.pyplot as plt
from collections import Counter
from sklearn.metrics import f1_score, accuracy_score, recall_score, cohen_kappa_score, confusion_matrix
from statsmodels.stats.contingency_tables import mcnemar
import jiwer, sklearn

from vihepat_ia.triage_rules import evaluer_triage, niveau_depuis_extraction, NIVEAUX, ORDRE, SYMPTOMES, SIGNES_GRAVES
from vihepat_ia.baseline_mots_cles import extraire as extraire_mots_cles
from vihepat_ia import gemini as G

GRAINE = 42
rng = np.random.default_rng(GRAINE)
pd.set_option("display.max_colwidth", 120)
print("Python", platform.python_version(), "| scikit-learn", sklearn.__version__, "| prompt", G.PROMPT["version"])

# Couleurs : 4 premiers emplacements d'une palette catégorielle validée (daltonisme), dans un ordre fixe
COULEURS = {"A · mots-clés": "#2a78d6", "B · TF-IDF": "#eb6834", "C · Gemini Flash-Lite": "#1baf7a", "D · Gemini Flash": "#eda100"}
plt.rcParams.update({"axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.alpha": .25,
                     "font.size": 10, "figure.dpi": 110})
""")

md(r"""
## 1. Les données

**Origine.** 165 messages de patients **fictifs** (vignettes) rédigés par l'équipe en français parlé au Bénin : expressions locales (« corps chaud », « ventre qui coule »), fautes d'orthographe, hésitations, négations, messages hors sujet, signes de gravité dits de façon indirecte. **Aucune donnée réelle de patient** n'a été utilisée.

**Annotation.** Pour chaque message, l'équipe a noté les champs attendus (symptômes, durée, intensité, signes de gravité) selon un guide écrit *avant* les essais (même définitions que les boutons de l'application). Le niveau attendu = moteur de règles appliqué à ces champs. On évalue donc **la compréhension du message**, à moteur de règles constant.

**Ce que ce jeu ne prouve pas** : la justesse clinique des règles elles-mêmes (à faire valider par des médecins), ni la performance sur de vrais patients. Voir section 9.
""")
code(r"""
vignettes = [json.loads(l) for l in (IA / "data" / "vignettes.jsonl").read_text(encoding="utf-8").splitlines()]
df = pd.DataFrame(vignettes).set_index("id")
df["niveau_or"] = [niveau_depuis_extraction(v, v["traitement_recent"]) for v in vignettes]
df["mots"] = df.texte.str.split().str.len()
print(len(df), "messages |", df.mots.median(), "mots en médiane (min", df.mots.min(), ", max", df.mots.max(), ")")
display(pd.crosstab(df.cat, df.niveau_or, margins=True, margins_name="total")[NIVEAUX + ["total"]])
""")
code(r"""
freq = Counter(s for l in df.symptomes for s in l)
freq_g = Counter(s for l in df.signes_graves for s in l)
fig, ax = plt.subplots(1, 2, figsize=(10, 3.4))
for a, f, titre in [(ax[0], freq, "Symptômes annotés"), (ax[1], freq_g, "Signes de gravité annotés")]:
    k = sorted(f, key=f.get)
    a.barh(k, [f[x] for x in k], color="#2a78d6", height=.6)
    a.set_title(titre, loc="left"); a.grid(axis="y", visible=False)
    for i, x in enumerate(k): a.text(f[x] + .3, i, f[x], va="center", fontsize=8, color="#52514e")
plt.tight_layout(); plt.show()
print("Champs non précisés par le patient : durée", (df.duree == "inconnue").mean().round(2), "| intensité", (df.intensite == "inconnue").mean().round(2))
""")

md(r"""
## 2. Le moteur de règles du notebook est bien celui de l'application

Le moteur est écrit en TypeScript dans l'application et porté en Python ici. Pour vérifier le portage, 5 000 combinaisons aléatoires (graine fixe) ont été évaluées par la version TypeScript (`npm run ia:parite` dans `backend/`) puis comparées.
""")
code(r"""
cas = json.loads((IA / "data" / "parite_ts.json").read_text())
diff = [c for c in cas if evaluer_triage(set(c["symptomes"]), c["duree"], c["intensite"], c["signesGraves"], c["traitementRecent"])[0] != c["niveau"]]
print(f"{len(cas)} cas comparés, {len(diff)} divergence(s) entre TypeScript et Python")
assert not diff
""")

md("## 3. Modèle A : mots-clés + règles (référence sans IA générative)")
md(r"""
Lexique de symptômes, d'expressions locales et de signes de gravité, avec une gestion simple des négations (« pas de fièvre »). Il reprend le même vocabulaire familier que celui donné à Gemini.

⚠️ **Biais en sa faveur** : ce lexique a été écrit par la même équipe que les vignettes, en les connaissant. Son score ici est un **plafond optimiste** ; sur des messages nouveaux, il baisserait.
""")
code(r"""
t0 = time.perf_counter()
ext_A = {i: extraire_mots_cles(t) for i, t in df.texte.items()}
lat_A_ms = (time.perf_counter() - t0) * 1000 / len(df)
df["pred_A"] = [niveau_depuis_extraction(ext_A[i], df.traitement_recent[i]) for i in df.index]
print(f"Latence moyenne : {lat_A_ms:.3f} ms par message (sur ce PC, sans réseau)")
""")

md(r"""
## 4. Modèle B : TF-IDF + régression logistique (apprentissage supervisé)

Il apprend **directement** texte → niveau, sans passer par les champs. Avec 165 exemples, on l'évalue par **validation croisée stratifiée à 5 plis, répétée 20 fois** (chaque message est prédit par un modèle qui ne l'a pas vu). Hyperparamètres fixés a priori (pas de recherche, pour ne pas sur-ajuster sur un si petit jeu).
""")
code(r"""
from sklearn.pipeline import make_pipeline, make_union
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict

def modele_B():
    return make_pipeline(
        make_union(TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True, strip_accents="unicode"),
                   TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode")),
        LogisticRegression(C=10, class_weight="balanced", max_iter=2000))

# Le contexte « traitement récent » vient du dossier, pas du message : on le donne au modèle comme un mot
X = (df.texte + np.where(df.traitement_recent, " TRAITEMENTRECENT", "")).values
y = df.niveau_or.values
scores_rep = []
for r in range(20):
    p = cross_val_predict(modele_B(), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=r))
    scores_rep.append((accuracy_score(y, p), f1_score(y, p, average="macro")))
    if r == 0: df["pred_B"] = p
scores_rep = np.array(scores_rep)
print(f"Exactitude {scores_rep[:,0].mean():.3f} ± {scores_rep[:,0].std():.3f} | F1 macro {scores_rep[:,1].mean():.3f} ± {scores_rep[:,1].std():.3f}  (20 répétitions)")

m = modele_B().fit(X, y)
t0 = time.perf_counter(); m.predict(X); lat_B_ms = (time.perf_counter() - t0) * 1000 / len(X)
print(f"Latence moyenne d'inférence : {lat_B_ms:.3f} ms par message")
""")

md(r"""
## 5. Modèles C et D : Gemini comme extracteur + moteur de règles

**Prompt** (`backend/src/ia/extraction.json`, version `extraction-v1`, le même fichier que l'application) :
- *instruction système* : rôle limité à l'extraction, 6 règles (ne rien inventer, respecter les négations, signes de gravité même indirects, définitions de la durée et de l'intensité identiques aux boutons de l'application, « autre » + précision, aucun diagnostic) et un petit lexique local ;
- *sortie contrainte* : `responseMimeType = application/json` + `responseSchema` à listes fermées (le modèle ne peut pas répondre hors des catégories) ;
- *paramètres* : `temperature = 0` (réponses aussi stables que possible), pas d'exemples (zero-shot).

Le prompt a été figé **avant** la première exécution sur ce jeu ; il n'a pas été retouché d'après les résultats.

Les appels sont faits **un par un, sans nouvelle tentative automatique** dans la mesure : chaque échec (surcharge 503, délai) est journalisé. Un message en échec est retenté plus tard (3 essais max), ce qui permet de mesurer aussi la **fiabilité du service**.
""")
code(r"""
MODELES = {"C": "gemini-3.5-flash-lite", "D": "gemini-3.8-flash"}
if REFAIRE_APPELS:
    for modele in MODELES.values():
        G.evaluer(vignettes, modele, IA / "resultats" / f"{modele}__texte.jsonl")

res, journal = {}, {}
for k, modele in MODELES.items():
    res[k], journal[k] = G.charger(IA / "resultats" / f"{modele}__texte.jsonl")
    df[f"pred_{k}"] = [niveau_depuis_extraction(res[k][i]["extraction"], df.traitement_recent[i]) if i in res[k] else None for i in df.index]

lignes = []
for k, modele in MODELES.items():
    j = pd.DataFrame(journal[k])
    lignes.append({"modèle": modele, "version servie": ", ".join(sorted(j["version_modele"].dropna().unique())) if "version_modele" in j else "aucune réponse",
                   "appels": len(j), "réussis": int(j.ok.sum()), "taux de réussite par appel": round(j.ok.mean(), 3),
                   "messages couverts": f"{len(res[k])}/{len(df)}",
                   "erreurs": dict(Counter(j.erreur.dropna())),
                   "dernier message d'erreur": (j[~j.ok].message.dropna().iloc[-1][:110] if "message" in j and j[~j.ok].message.notna().any() else "")})
fiabilite = pd.DataFrame(lignes).set_index("modèle"); fiabilite
""")

md(r"""
## 6. Résultats : priorité d'alerte

Pour une comparaison équitable, les modèles sont évalués sur **les mêmes messages** (ceux que tous les modèles Gemini retenus ont traités). Un modèle Gemini n'est retenu que s'il a répondu à au moins 30 messages ; sinon seule sa fiabilité (section 5) est rapportée. Intervalles de confiance à 95 % par bootstrap (2 000 tirages).
""")
code(r"""
TOUS = {"A": "A · mots-clés", "B": "B · TF-IDF", "C": "C · Gemini Flash-Lite", "D": "D · Gemini Flash"}
GEMINI_OK = [k for k in MODELES if df[f"pred_{k}"].notna().sum() >= 30]
NOMS = {k: v for k, v in TOUS.items() if k in ("A", "B") or k in GEMINI_OK}
for k in MODELES:
    if k not in GEMINI_OK:
        print(f"⚠️ {TOUS[k]} exclu de la comparaison : {df[f'pred_{k}'].notna().sum()} réponse(s) obtenue(s) (voir fiabilité)")
commun = df.dropna(subset=[f"pred_{k}" for k in GEMINI_OK]).index
print(f"Modèles comparés : {list(NOMS.values())} | messages communs : {len(commun)}/{len(df)}")

def metriques(g, p):
    go, po = np.array([ORDRE[x] for x in g]), np.array([ORDRE[x] for x in p])
    return {"exactitude": np.mean(go == po), "F1 macro": f1_score(go, po, average="macro"),
            "rappel alerte": np.mean(po[go == 2] == 2), "sous-triage": np.mean(po < go), "sur-triage": np.mean(po > go),
            "kappa pondéré": cohen_kappa_score(go, po, weights="quadratic")}

def bootstrap(g, p, n=2000):
    g, p = np.asarray(g), np.asarray(p)
    tirages = [metriques(g[i], p[i]) for i in (rng.integers(0, len(g), len(g)) for _ in range(n))]
    return {m: np.percentile([t[m] for t in tirages], [2.5, 97.5]) for m in tirages[0]}

tab, ic = {}, {}
for k in NOMS:
    g, p = df.loc[commun, "niveau_or"].values, df.loc[commun, f"pred_{k}"].values
    tab[NOMS[k]], ic[NOMS[k]] = metriques(g, p), bootstrap(g, p)
resultats = pd.DataFrame(tab).T
affiche = resultats.copy().astype(object)
for nom in affiche.index:
    for m in affiche.columns:
        lo, hi = ic[nom][m]; affiche.loc[nom, m] = f"{resultats.loc[nom, m]:.3f} [{lo:.2f}–{hi:.2f}]"
affiche
""")
code(r"""
fig, axes = plt.subplots(1, 3, figsize=(11, 3.4), sharey=False)
for ax, m, titre in zip(axes, ["exactitude", "rappel alerte", "sous-triage"],
                        ["Exactitude (↑)", "Rappel des alertes (↑)", "Sous-triage (↓, erreur dangereuse)"]):
    noms = list(NOMS.values())
    v = [resultats.loc[n, m] for n in noms]
    err = np.array([[v[i] - ic[n][m][0], ic[n][m][1] - v[i]] for i, n in enumerate(noms)]).T
    ax.bar(range(len(noms)), v, color=[COULEURS[n] for n in noms], width=.62, yerr=err, capsize=3, ecolor="#52514e", edgecolor="white", linewidth=2)
    for i, x in enumerate(v): ax.text(i, x + .02, f"{x:.2f}", ha="center", fontsize=8, color="#0b0b0b")
    ax.set_xticks(range(len(noms)), [n.split(" · ")[0] for n in noms]); ax.set_title(titre, loc="left", fontsize=10)
    ax.set_ylim(0, 1.1 if m != "sous-triage" else max(.3, max(v) + .1)); ax.grid(axis="x", visible=False)
fig.legend([plt.Rectangle((0, 0), 1, 1, color=COULEURS[n]) for n in NOMS.values()], NOMS.values(), ncol=len(NOMS), loc="lower center", frameon=False, bbox_to_anchor=(.5, -.06))
plt.tight_layout(); plt.show()
""")
code(r"""
fig, axes = plt.subplots(1, len(NOMS), figsize=(3.3 * len(NOMS), 3.2))
lib = ["banal", "à surv.", "alerte"]
for ax, (k, nom) in zip(axes, NOMS.items()):
    cm = confusion_matrix(df.loc[commun, "niveau_or"], df.loc[commun, f"pred_{k}"], labels=NIVEAUX)
    ax.imshow(cm, cmap="Blues", vmin=0); ax.grid(False)
    for (i, j), v in np.ndenumerate(cm):
        ax.text(j, i, v, ha="center", va="center", color="white" if v > cm.max() / 2 else "#0b0b0b", fontsize=9)
    ax.set_xticks(range(3), lib, fontsize=8); ax.set_yticks(range(3), lib, fontsize=8)
    ax.set_xlabel("prédit"); ax.set_title(nom, loc="left", fontsize=9)
axes[0].set_ylabel("attendu"); plt.tight_layout(); plt.show()
print("Sous la diagonale = sous-triage (dangereux) ; au-dessus = sur-triage.")
""")
code(r"""
# Test de McNemar exact : les différences d'exactitude entre deux modèles sont-elles significatives ?
def mc(a, b):
    ok_a = df.loc[commun, f"pred_{a}"] == df.loc[commun, "niveau_or"]
    ok_b = df.loc[commun, f"pred_{b}"] == df.loc[commun, "niveau_or"]
    t = [[int((ok_a & ok_b).sum()), int((ok_a & ~ok_b).sum())], [int((~ok_a & ok_b).sum()), int((~ok_a & ~ok_b).sum())]]
    return {"paire": f"{a} vs {b}", "seul le 1er juste": t[0][1], "seul le 2e juste": t[1][0], "p (McNemar exact)": round(mcnemar(t, exact=True).pvalue, 4)}
paires = [(a, b) for a, b in [("C", "A"), ("C", "B"), ("D", "A"), ("D", "C"), ("A", "B")] if a in NOMS and b in NOMS]
pd.DataFrame([mc(a, b) for a, b in paires])
""")
code(r"""
# Par type de message : où chaque méthode décroche
par_cat = pd.DataFrame({NOMS[k]: (df.loc[commun, f"pred_{k}"] == df.loc[commun, "niveau_or"]).groupby(df.loc[commun, "cat"]).mean() for k in NOMS})
par_cat.insert(0, "n", df.loc[commun].groupby("cat").size())
par_cat.round(2)
""")

md("## 7. Qualité de l'extraction champ par champ (A, C, D)")
code(r"""
def prf(gold, pred):
    tp = sum(len(set(g) & set(p)) for g, p in zip(gold, pred)); fp = sum(len(set(p) - set(g)) for g, p in zip(gold, pred))
    fn = sum(len(set(g) - set(p)) for g, p in zip(gold, pred))
    pr = tp / (tp + fp) if tp + fp else 1.0; rc = tp / (tp + fn) if tp + fn else 1.0
    return pr, rc, 2 * pr * rc / (pr + rc) if pr + rc else 0.0

lignes = []
sources = {"A": {i: ext_A[i] for i in commun}, **{k: {i: res[k][i]["extraction"] for i in commun} for k in GEMINI_OK}}
for k, ext in sources.items():
    for champ in ["symptomes", "signes_graves"]:
        pr, rc, f1 = prf([df.loc[i, champ] for i in commun], [ext[i].get(champ, []) for i in commun])
        lignes.append({"modèle": NOMS[k], "champ": champ, "précision": pr, "rappel": rc, "F1": f1})
    for champ in ["duree", "intensite"]:
        acc = np.mean([ext[i].get(champ) == df.loc[i, champ] for i in commun])
        lignes.append({"modèle": NOMS[k], "champ": champ, "précision": np.nan, "rappel": np.nan, "F1": acc})
extraction = pd.DataFrame(lignes).pivot(index="champ", columns="modèle", values="F1").round(3)
print("F1 (symptômes, signes de gravité) ou exactitude (durée, intensité)"); extraction
""")
code(r"""
# Rappel des signes de gravité, signe par signe : un signe raté = une urgence manquée
lignes = []
for g in SIGNES_GRAVES:
    porteurs = [i for i in commun if g in df.loc[i, "signes_graves"]]
    lignes.append({"signe": g, "n": len(porteurs), **{NOMS[k]: np.mean([g in sources[k][i].get("signes_graves", []) for i in porteurs]) if porteurs else np.nan for k in sources}})
pd.DataFrame(lignes).set_index("signe").round(2)
""")

md(r"""
## 8. La voix : transcription puis priorité (sous-corpus audio)

42 messages (un sur quatre) ont été lus par 3 voix de synthèse françaises (Windows : Hortense, Julie, Paul) puis encodés en WebM/Opus 24 kb/s, **le format qu'envoie Chrome** depuis l'application. Gemini reçoit l'audio directement (transcription + extraction en un seul appel).

On mesure : le **taux d'erreur de mots (WER)** de la transcription, l'exactitude du niveau, et la latence. Limite forte : une voix de synthèse est plus nette qu'un patient réel (accent, bruit, débit) ; ces chiffres sont un **plafond**.
""")
code(r"""
if REFAIRE_APPELS:
    ids_audio = {p.stem for p in (IA / "data" / "audio").glob("*.webm")}
    for modele in MODELES.values():
        G.evaluer([v for v in vignettes if v["id"] in ids_audio], modele, IA / "resultats" / f"{modele}__audio.jsonl",
                  modalite="audio", dossier_audio=IA / "data" / "audio")

norm = jiwer.Compose([jiwer.ToLowerCase(), jiwer.RemovePunctuation(), jiwer.RemoveMultipleSpaces(), jiwer.Strip(), jiwer.ReduceToListOfListOfWords()])
lignes, res_audio = [], {}
for k, modele in MODELES.items():
    f = IA / "resultats" / f"{modele}__audio.jsonl"
    if not f.exists(): continue
    ok, jr = G.charger(f); res_audio[k] = ok
    ids = sorted(ok)
    pred = [niveau_depuis_extraction(ok[i]["extraction"], df.traitement_recent[i]) for i in ids]
    wer = jiwer.wer([df.texte[i] for i in ids], [ok[i]["extraction"]["transcription"] for i in ids], reference_transform=norm, hypothesis_transform=norm)
    lat = np.array([ok[i]["latence_ms"] for i in ids])
    m = metriques(df.loc[ids, "niveau_or"].values, np.array(pred))
    m_txt = metriques(df.loc[ids, "niveau_or"].values, df.loc[ids, f"pred_{k}"].values) if df.loc[ids, f"pred_{k}"].notna().all() else {}
    lignes.append({"modèle": modele, "messages": f"{len(ids)}/42", "taux réussite appel": round(pd.DataFrame(jr).ok.mean(), 3),
                   "WER": round(wer, 3), "exactitude niveau (audio)": round(m["exactitude"], 3),
                   "même messages en texte": round(m_txt.get("exactitude", np.nan), 3),
                   "sous-triage (audio)": round(m["sous-triage"], 3),
                   "latence médiane (s)": round(np.median(lat) / 1000, 2), "latence p95 (s)": round(np.percentile(lat, 95) / 1000, 2),
                   "tokens audio moyens": round(np.mean([ok[i]["tokens_audio"] for i in ids]))})
audio = pd.DataFrame(lignes).set_index("modèle"); audio
""")

md("## 9. Latence et coût mesurés")
md(r"""
Prix officiels relevés le **05/10/2026** sur https://ai.google.dev/gemini-api/docs/pricing (palier payant ; un palier gratuit existe pour les deux modèles) :

| Modèle | Entrée (texte et audio) | Sortie (raisonnement compris) |
|---|---|---|
| gemini-3.8-flash | 0,75 $ / M tokens (jusqu'au 31/12/2026, puis 1,50 $) | 3,75 $ / M (puis 7,50 $) |
| gemini-3.5-flash-lite | 0,30 $ / M | 2,50 $ / M |

Les latences sont mesurées depuis le PC de développement de l'équipe, sur sa connexion habituelle : elles incluent le réseau et varient selon la connexion du patient. Les tokens sont ceux renvoyés par l'API (`usageMetadata`).
""")
code(r"""
PRIX = {"gemini-3.8-flash": (0.75, 3.75), "gemini-3.5-flash-lite": (0.30, 2.50)}  # $/M tokens, relevé du 05/10/2026
lignes = []
for k, modele in MODELES.items():
    for modalite, ok in [("texte", res.get(k, {})), ("audio", res_audio.get(k, {}))]:
        if not ok: continue
        d = pd.DataFrame(ok.values())
        cout = (d.tokens_entree * PRIX[modele][0] + (d.tokens_sortie + d.tokens_reflexion) * PRIX[modele][1]) / 1e6
        lignes.append({"modèle": modele, "entrée": modalite, "n": len(d),
                       "latence médiane (s)": round(d.latence_ms.median() / 1000, 2), "p95 (s)": round(d.latence_ms.quantile(.95) / 1000, 2),
                       "tokens entrée": round(d.tokens_entree.mean()), "tokens sortie": round(d.tokens_sortie.mean()),
                       "tokens raisonnement": round(d.tokens_reflexion.mean()),
                       "coût / 1 000 notes ($)": round(cout.mean() * 1000, 3)})
lignes += [{"modèle": "A · mots-clés", "entrée": "texte", "n": len(df), "latence médiane (s)": round(lat_A_ms / 1000, 6), "coût / 1 000 notes ($)": 0},
           {"modèle": "B · TF-IDF", "entrée": "texte", "n": len(df), "latence médiane (s)": round(lat_B_ms / 1000, 6), "coût / 1 000 notes ($)": 0}]
couts = pd.DataFrame(lignes).set_index(["modèle", "entrée"]); couts
""")

md("## 10. Analyse d'erreurs : tous les sous-triages des modèles Gemini")
code(r"""
lignes = []
for k in GEMINI_OK:
    for i in commun:
        g, p = df.loc[i, "niveau_or"], df.loc[i, f"pred_{k}"]
        if ORDRE[p] < ORDRE[g]:
            x = res[k][i]["extraction"]
            lignes.append({"modèle": k, "id": i, "texte": df.texte[i], "attendu": g, "prédit": p,
                           "attendu (champs)": f"{df.symptomes[i]} {df.duree[i]}/{df.intensite[i]} {df.signes_graves[i]}",
                           "extrait": f"{x['symptomes']} {x['duree']}/{x['intensite']} {x['signes_graves']}"})
pd.DataFrame(lignes) if lignes else print("Aucun sous-triage.")
""")
code(r"""
# Stabilité : même requête, température 0, plusieurs appels ont-ils donné la même extraction ?
for k in GEMINI_OK:
    j = pd.DataFrame(journal[k]); j = j[j.ok]
    rep = j.groupby("id").filter(lambda g: len(g) > 1)
    if len(rep):
        stables = rep.groupby("id").apply(lambda g: len({json.dumps({c: sorted(v) if isinstance(v, list) else v for c, v in e.items() if c not in ("transcription", "precision")}, sort_keys=True) for e in g.extraction}) == 1)
        print(MODELES[k], ":", f"{stables.mean():.0%} d'extractions identiques sur {len(stables)} messages appelés plusieurs fois")
    else:
        print(MODELES[k], ": aucun message appelé plusieurs fois avec succès (stabilité non mesurée ici)")
""")

md(r"""
## 11. Conclusions, limites assumées et éthique

Les chiffres ci-dessus sont produits par l'exécution de ce notebook ; le résumé chiffré est dans `ia/RESULTATS.md` (régénéré par la dernière cellule).

**Limites (à dire au jury)**
1. **Données synthétiques** : 165 vignettes écrites par l'équipe, pas de vrais patients. Un vocabulaire plus riche ou plus local ferait baisser tous les scores, surtout celui du modèle A.
2. **Annotation par l'équipe**, sans double annotation ni validation médicale : l'accord inter-annotateurs n'est pas mesuré.
3. **Moteur de règles non validé cliniquement** : on mesure la compréhension du message, pas la pertinence médicale des seuils.
4. **Audio de synthèse** (accent de France, sans bruit) : WER et exactitude audio sont des plafonds.
5. **Fon non évalué** : aucune note en fon dans ce jeu. Nous ne revendiquons donc aucune performance en fon. Le notebook est prêt à l'accepter (déposer `data/audio_fon/*.webm` + annotations).
6. **Petit échantillon** : intervalles de confiance larges (voir section 6) ; les écarts non significatifs au test de McNemar ne doivent pas être présentés comme des gains.
7. **Modèle « latest » mouvant** : on fixe des versions précises (`gemini-3.8-flash`, `gemini-3.5-flash-lite`), et chaque réponse garde la version servie.

**Biais**
- Le jeu est en français standard ou familier ; les patients peu à l'aise à l'écrit ou parlant surtout une langue nationale sont sous-représentés, donc l'outil risque de mieux servir les plus favorisés. Réponse dans l'application : le formulaire à pictogrammes et la lecture à voix haute restent toujours disponibles, et l'analyse vocale ne fait que **pré-remplir**.
- Erreurs asymétriques : on privilégie le rappel des alertes (sous-triage minimal) au prix d'alertes en trop.

**Confidentialité**
- L'audio est envoyé à Google (API Gemini) **uniquement si le patient appuie sur « Analyser »** ; il n'est pas stocké par VIHEPAT. Seule la transcription rejoint le signalement, comme un texte tapé.
- Le journal de mesures du serveur (`backend/logs/ia-mesures.jsonl`) ne contient ni identifiant ni contenu : latence, tokens, niveau.
- En production, il faudra un palier payant (les données du palier gratuit peuvent servir à améliorer les produits Google), un consentement explicite, et l'avis de l'autorité béninoise de protection des données (APDP).

**Garde-fous**
- Le LLM ne décide jamais de la priorité ; le patient voit et corrige les champs avant envoi ; les signes de gravité restent cochables à la main ; hors ligne ou en cas d'échec de Gemini, le triage embarqué fonctionne seul.
""")
code(r"""
# Résumé chiffré exporté (utilisé pour le README et la présentation)
lignes = [f"# Résultats de l'évaluation (généré le {time.strftime('%d/%m/%Y %H:%M')} par le notebook)", "",
          f"Jeu : {len(df)} messages fictifs ({dict(Counter(df.niveau_or))}), {len(commun)} évalués pour les modèles {', '.join(NOMS.values())}. Prompt `{G.PROMPT['version']}`.", "",
          "## Priorité d'alerte (IC 95 % bootstrap)", "", affiche.to_markdown(), "",
          "## Fiabilité de l'API pendant la mesure", "", fiabilite.to_markdown(), "",
          "## Audio (voix de synthèse, 42 messages)", "", audio.to_markdown() if len(audio) else "_non exécuté_", "",
          "## Latence et coût", "", couts.to_markdown(), "",
          "## Extraction champ par champ", "", extraction.to_markdown()]
(IA / "RESULTATS.md").write_text("\n".join(lignes), encoding="utf-8")
print("ia/RESULTATS.md écrit")
""")

nb = nbf.v4.new_notebook(cells=C, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"},
                                            "colab": {"provenance": []}})
sortie = Path(__file__).resolve().parents[1] / "VIHEPAT_evaluation_IA.ipynb"
nbf.write(nb, sortie)
print("écrit :", sortie)
