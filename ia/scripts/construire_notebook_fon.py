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
if EN_COLAB and not Path("vihepat").exists():
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
## 2. Reconnaissance vocale (MMS) puis traduction (NLLB-200)

Les deux modèles sont chargés l'un après l'autre (mémoire). Les sorties intermédiaires sont gardées : on pourra dire **où** la chaîne casse (reconnaissance ou traduction).
""")
code(r"""
from vihepat_ia.fon_pipeline import TranscripteurFon, TraducteurFonFr, charger_audio_16k, chronometre

lignes = []
asr = TranscripteurFon(DEVICE)
for f in notes:
    audio = charger_audio_16k(f)
    texte_fon, ms = chronometre(asr, audio)
    lignes.append({"id": f.stem, "vignette": MOTIF.match(f.name).group(2), "duree_s": round(len(audio) / 16000, 1),
                   "texte_fon": texte_fon, "ms_mms": round(ms)})
del asr; torch.cuda.empty_cache() if DEVICE == "cuda" else None

trad = TraducteurFonFr(DEVICE)
for l in lignes:
    l["texte_fr"], ms = chronometre(trad, l["texte_fon"]) if l["texte_fon"] else ("", 0)
    l["ms_nllb"] = round(ms)
del trad

pd.set_option("display.max_colwidth", 110)
df = pd.DataFrame(lignes)
df["phrase de la fiche"] = df.vignette.map(lambda v: vignettes[v]["texte"])
df[["id", "texte_fon", "texte_fr", "phrase de la fiche"]]
""")

md(r"""
## 3. Extraction (Gemini, texte) puis moteur de règles

Même prompt `extraction-v1` que l'application, cette fois sur la **traduction française**. Résultats mis en cache dans `resultats/fon_mms_nllb.jsonl`.
""")
code(r"""
from vihepat_ia import gemini as G
from vihepat_ia.triage_rules import niveau_depuis_extraction, ORDRE

CACHE = IA / "resultats" / "fon_mms_nllb.jsonl"
deja = {json.loads(l)["id"]: json.loads(l) for l in CACHE.read_text(encoding="utf-8").splitlines()} if CACHE.exists() else {}
cle = os.environ.get("GEMINI_API_KEY")
with CACHE.open("a", encoding="utf-8") as out:
    for l in lignes:
        if l["id"] in deja and deja[l["id"]].get("ok") and deja[l["id"]].get("texte_fr") == l["texte_fr"]:
            continue
        if not cle:
            print("Pas de clé Gemini : étape sautée (ajoutez GEMINI_API_KEY dans les secrets Colab)"); break
        r = G.appeler("gemini-3.5-flash-lite", [{"text": G.PROMPT["user_text"] + (l["texte_fr"] or "(vide)")}], cle)
        r.update(l, prompt=G.PROMPT["version"], modeles="mms-1b-all:fon + nllb-200-distilled-600M + gemini-3.5-flash-lite",
                 horodatage=time.strftime("%Y-%m-%dT%H:%M:%S"))
        out.write(json.dumps(r, ensure_ascii=False) + "\n"); deja[l["id"]] = r
        print(l["id"], "ok" if r["ok"] else r.get("erreur")); time.sleep(4)
""")

md("## 4. Résultat : MMS + NLLB + Gemini contre Gemini seul, sur les mêmes notes")
code(r"""
direct = {}
f_direct = IA / "resultats" / "gemini-3.5-flash-lite__reel.jsonl"
if f_direct.exists():
    for l in f_direct.read_text(encoding="utf-8").splitlines():
        x = json.loads(l)
        if x["ok"]: direct[x["id"]] = x

res = []
for l in lignes:
    v = vignettes[l["vignette"]]; attendu = niveau_depuis_extraction(v, v["traitement_recent"])
    r = deja.get(l["id"], {})
    via = niveau_depuis_extraction(r["extraction"], v["traitement_recent"]) if r.get("ok") else None
    d = direct.get(l["id"])
    seul = niveau_depuis_extraction(d["extraction"], v["traitement_recent"]) if d else None
    res.append({"note": l["id"], "attendu": attendu, "Gemini seul": seul, "MMS+NLLB+Gemini": via,
                "symptômes attendus": v["symptomes"] + v["signes_graves"],
                "symptômes trouvés (MMS+NLLB)": (r["extraction"]["symptomes"] + r["extraction"]["signes_graves"]) if r.get("ok") else None})
res = pd.DataFrame(res); display(res)

for col in ["Gemini seul", "MMS+NLLB+Gemini"]:
    ok = res.dropna(subset=[col])
    if len(ok):
        juste = (ok[col] == ok.attendu).sum()
        sous = sum(ORDRE[p] < ORDRE[a] for p, a in zip(ok[col], ok.attendu))
        print(f"{col:17} : {juste}/{len(ok)} bien classées, {sous} alerte(s) sous-estimée(s)")
print(f"Temps moyen : MMS {df.ms_mms.mean():.0f} ms, NLLB {df.ms_nllb.mean():.0f} ms par note ({DEVICE})")
""")

md(r"""
## 5. Lecture des résultats et suite

- **Si la traduction française a du sens** mais que le niveau reste faux : le problème est dans l'extraction, on peut l'améliorer.
- **Si le texte fon de MMS est déjà faux** : la reconnaissance vocale est le maillon faible (MMS a surtout été entraîné sur des lectures de textes religieux, très différentes d'un patient qui parle au téléphone).
- **À faire relire par une personne qui parle fon** : la colonne `texte_fon`, pour dire si MMS a bien entendu.

Pour rapatrier les résultats dans le dépôt : téléchargez `resultats/fon_mms_nllb.jsonl` (cellule suivante) et déposez-le dans `ia/resultats/` sur le PC de l'équipe.
""")
code(r"""
if EN_COLAB and CACHE.exists():
    from google.colab import files
    files.download(str(CACHE))
""")

nb = nbf.v4.new_notebook(cells=C, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"},
                                            "accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4"}})
sortie = Path(__file__).resolve().parents[1] / "VIHEPAT_fon_MMS_NLLB.ipynb"
nbf.write(nb, sortie)
print("écrit :", sortie)
