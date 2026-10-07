"""Construit ia/VIHEPAT_fon_MMS_NLLB.ipynb (piste fon, à exécuter sur Colab avec GPU).
   python ia/scripts/construire_notebook_fon.py
"""
from pathlib import Path

import nbformat as nbf

C = []
md = lambda s: C.append(nbf.v4.new_markdown_cell(s.strip()))
code = lambda s: C.append(nbf.v4.new_code_cell(s.strip()))
COLAB = "https://colab.research.google.com/github/yantekouarabiatou/-vihepat/blob/main/ia/VIHEPAT_fon_MMS_NLLB.ipynb"

md(rf"""
# VIHEPAT : peut-on comprendre une note vocale en fon ?

[![Ouvrir dans Colab](https://colab.research.google.com/assets/colab-badge.svg)]({COLAB})

**Constat de départ** (notebook principal, section 8 bis) : envoyée directement à Gemini, une note en fon est reconnue comme du fon mais **pas comprise** : 0 alerte détectée sur 9, transcriptions inventées.

**Hypothèse testée ici** : passer par des modèles spécialisés qui couvrent le fon, puis réutiliser notre chaîne habituelle.

```
audio fon ──► MMS (Meta, adaptateur « fon ») ──► texte fon
          ──► NLLB-200 (Meta, fon_Latn → fra_Latn) ──► texte français
          ──► Gemini (même prompt que l'application) ──► champs ──► moteur de règles ──► niveau
```

On compare au résultat direct (audio fon → Gemini) **sur les mêmes notes**. Le prompt, le schéma et les règles ne changent pas.

**Exécution** : Exécution → Modifier le type d'exécution → **GPU T4**, puis Tout exécuter. Le notebook demande le zip des notes en fon (les voix de l'équipe ne sont pas sur GitHub).
""")

md("## 0. Installation")
code(r"""
import sys, os, subprocess, json, time, zipfile, re
from pathlib import Path

EN_COLAB = "google.colab" in sys.modules
if EN_COLAB:
    # Toujours la dernière version du dépôt, même si la session Colab en garde une ancienne copie
    if Path("vihepat").exists():
        subprocess.run(["git", "-C", "vihepat", "pull", "--ff-only"], check=True)
    else:
        subprocess.run(["git", "clone", "--depth", "1", "https://github.com/yantekouarabiatou/-vihepat.git", "vihepat"], check=True)
IA = next(p for p in [Path.cwd(), Path.cwd() / "ia", Path("vihepat/ia")] if (p / "vihepat_ia").exists()).resolve()
sys.path.insert(0, str(IA))
if EN_COLAB:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "transformers>=4.44", "sentencepiece", "accelerate", "jiwer"], check=True)
    try:
        from google.colab import userdata
        os.environ.setdefault("GEMINI_API_KEY", userdata.get("GEMINI_API_KEY") or "")
    except Exception:
        pass

import torch, numpy as np, pandas as pd
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print("Appareil :", DEVICE, "| clé Gemini :", bool(os.environ.get("GEMINI_API_KEY")))
if DEVICE == "cpu":
    print("⚠️ Pas de GPU : ça marche, mais lentement. Colab : Exécution > Modifier le type d'exécution > T4 GPU")
""")

md("## 1. Les notes en fon")
code(r"""
DOSSIER = IA / "data" / "enregistrements" / "fon_colab"
DOSSIER.mkdir(parents=True, exist_ok=True)
MOTIF = re.compile(r"^fon_(L\d{1,2})_(V\d{3})\.(ogg|opus|m4a|mp3|wav|aac|amr|webm|mp4|3gp|flac)$", re.I)

# Sur Colab : téléverser audios_fon.zip (préparé sur le PC de l'équipe)
if EN_COLAB and not any(DOSSIER.iterdir()):
    from google.colab import files
    print("Choisissez le fichier audios_fon.zip")
    for nom, contenu in files.upload().items():
        with zipfile.ZipFile(__import__("io").BytesIO(contenu)) as z:
            for membre in z.namelist():
                if MOTIF.match(Path(membre).name):
                    (DOSSIER / Path(membre).name).write_bytes(z.read(membre))
# En local : reprendre les notes déjà déposées
for f in (IA / "data" / "enregistrements" / "brut").glob("fon_*"):
    if MOTIF.match(f.name) and not (DOSSIER / f.name).exists():
        (DOSSIER / f.name).write_bytes(f.read_bytes())

vignettes = {json.loads(l)["id"]: json.loads(l) for l in (IA / "data" / "vignettes.jsonl").read_text(encoding="utf-8").splitlines()}
notes = sorted((f for f in DOSSIER.iterdir() if MOTIF.match(f.name)), key=lambda f: f.name)
print(len(notes), "note(s) en fon :", [f.stem for f in notes])
assert notes, "Aucune note : téléversez audios_fon.zip"
""")

md(r"""
## 2. Reconnaissance vocale (MMS) puis traduction (NLLB-200, plusieurs tailles)

MMS ne tourne qu'une fois. La traduction est essayée avec plusieurs tailles de NLLB : le premier essai (600M) a montré que **la traduction est le maillon faible** (phrases inventées au ton biblique), alors que le texte fon de MMS semble plausible.

Une variante dont tous les résultats sont déjà en cache n'est **pas** recalculée : ses chiffres restent ceux mesurés.
""")
code(r"""
from vihepat_ia.fon_pipeline import TranscripteurFon, TraducteurFonFr, NLLB_VARIANTES, charger_audio_16k, chronometre

TESTER_3_3B = False  # True : ajoute la variante 3,3 milliards (17 Go à télécharger, peut saturer Colab gratuit)
VARIANTES = ["nllb-600M", "nllb-1.3B"] + (["nllb-3.3B"] if TESTER_3_3B else [])
fichier_cache = lambda k: IA / "resultats" / ("fon_mms_nllb.jsonl" if k == "nllb-600M" else f"fon_mms_{k}.jsonl")

def lire_cache(k):
    f = fichier_cache(k)
    dernier = {}
    if f.exists():
        for l in f.read_text(encoding="utf-8").splitlines():
            x = json.loads(l); dernier[x["id"]] = x
    return dernier

lignes = []
asr = TranscripteurFon(DEVICE)
for f in notes:
    audio = charger_audio_16k(f)
    texte_fon, ms = chronometre(asr, audio)
    lignes.append({"id": f.stem, "vignette": MOTIF.match(f.name).group(2), "duree_s": round(len(audio) / 16000, 1),
                   "texte_fon": texte_fon, "ms_mms": round(ms)})
del asr; torch.cuda.empty_cache() if DEVICE == "cuda" else None

traductions = {}  # variante -> {id: (texte_fr, ms)}
for k in VARIANTES:
    cache = lire_cache(k)
    if all(cache.get(l["id"], {}).get("ok") for l in lignes):
        traductions[k] = {i: (r["texte_fr"], r.get("ms_nllb")) for i, r in cache.items()}
        print(f"{k} : déjà mesuré, repris du cache"); continue
    trad = TraducteurFonFr(DEVICE, NLLB_VARIANTES[k])
    traductions[k] = {l["id"]: chronometre(trad, l["texte_fon"]) if l["texte_fon"] else ("", 0) for l in lignes}
    del trad; torch.cuda.empty_cache() if DEVICE == "cuda" else None
    print(f"{k} : traduit")

pd.set_option("display.max_colwidth", 90)
df = pd.DataFrame([{"id": l["id"], "fiche": vignettes[l["vignette"]]["texte"], "texte_fon (MMS)": l["texte_fon"],
                    **{k: traductions[k][l["id"]][0] for k in VARIANTES}} for l in lignes])
df
""")

md(r"""
## 3. Extraction (Gemini, texte) puis moteur de règles

Même prompt `extraction-v1` que l'application, sur chaque **traduction française**. Un fichier de résultats par variante dans `resultats/`.
""")
code(r"""
from vihepat_ia import gemini as G
from vihepat_ia.triage_rules import niveau_depuis_extraction, ORDRE

cle = os.environ.get("GEMINI_API_KEY")
resultats = {}
for k in VARIANTES:
    deja = lire_cache(k)
    with fichier_cache(k).open("a", encoding="utf-8") as out:
        for l in lignes:
            texte_fr, ms = traductions[k][l["id"]]
            if deja.get(l["id"], {}).get("ok") and deja[l["id"]].get("texte_fr") == texte_fr:
                continue
            if not cle:
                print("Pas de clé Gemini : étape sautée (ajoutez GEMINI_API_KEY dans les secrets Colab)"); break
            r = G.appeler("gemini-3.5-flash-lite", [{"text": G.PROMPT["user_text"] + (texte_fr or "(vide)")}], cle)
            r.update(l, texte_fr=texte_fr, ms_nllb=round(ms or 0), prompt=G.PROMPT["version"],
                     modeles=f"mms-1b-all:fon + {NLLB_VARIANTES[k].split('/')[-1]} + gemini-3.5-flash-lite",
                     horodatage=time.strftime("%Y-%m-%dT%H:%M:%S"))
            out.write(json.dumps(r, ensure_ascii=False) + "\n"); deja[l["id"]] = r
            print(k, l["id"], "ok" if r["ok"] else r.get("erreur")); time.sleep(4)
    resultats[k] = deja
""")

md(r"""
## 4. Résultat : chaque variante contre Gemini seul, sur les mêmes notes

« Bien classée » ne suffit pas : on vérifie aussi que **la bonne raison** a été trouvée (le signe de gravité ou le symptôme attendu), pour ne pas compter les réussites par hasard.
""")
code(r"""
direct = {}
f_direct = IA / "resultats" / "gemini-3.5-flash-lite__reel.jsonl"
if f_direct.exists():
    for l in f_direct.read_text(encoding="utf-8").splitlines():
        x = json.loads(l)
        if x["ok"]: direct[x["id"]] = x

sources = {"Gemini seul": direct, **{f"MMS+{k}+Gemini": resultats[k] for k in VARIANTES}}
tableau, bilan = [], []
for nom, src in sources.items():
    juste = bonne_raison = sous = n = 0
    for l in lignes:
        v = vignettes[l["vignette"]]; attendu = niveau_depuis_extraction(v, v["traitement_recent"])
        r = src.get(l["id"])
        if not (r and r.get("ok")): continue
        x = r["extraction"]; p = niveau_depuis_extraction(x, v["traitement_recent"]); n += 1
        cles_attendues = set(v["signes_graves"]) or set(v["symptomes"]) - {"autre"}
        raison = bool(cles_attendues & (set(x["signes_graves"]) | set(x["symptomes"])))
        juste += p == attendu; bonne_raison += (p == attendu and raison); sous += ORDRE[p] < ORDRE[attendu]
        tableau.append({"note": l["id"], "méthode": nom, "attendu": attendu, "obtenu": p, "bonne raison": raison,
                        "trouvé": x["symptomes"] + x["signes_graves"]})
    bilan.append({"méthode": nom, "notes": n, "bien classées": juste, "dont pour la bonne raison": bonne_raison,
                  "alertes sous-estimées": sous})
display(pd.DataFrame(bilan).set_index("méthode"))
pd.DataFrame(tableau).pivot(index="note", columns="méthode", values="obtenu")
""")

md(r"""
## 5. Lecture des résultats et suite

- **Si la traduction française a du sens** mais que le niveau reste faux : le problème est dans l'extraction, on peut l'améliorer.
- **Si le texte fon de MMS est déjà faux** : la reconnaissance vocale est le maillon faible (MMS a surtout été entraîné sur des lectures de textes religieux, très différentes d'un patient qui parle au téléphone).
- **À faire relire par une personne qui parle fon** : la colonne `texte_fon`, pour dire si MMS a bien entendu.

Pour rapatrier les résultats dans le dépôt : la cellule suivante télécharge les fichiers `resultats/fon_mms_*.jsonl` ; déposez-les dans `ia/resultats/` sur le PC de l'équipe.
""")
code(r"""
if EN_COLAB:
    from google.colab import files
    for k in VARIANTES:
        if fichier_cache(k).exists():
            files.download(str(fichier_cache(k)))
""")

nb = nbf.v4.new_notebook(cells=C, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"},
                                            "accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4"}})
sortie = Path(__file__).resolve().parents[1] / "VIHEPAT_fon_MMS_NLLB.ipynb"
nbf.write(nb, sortie)
print("écrit :", sortie)
