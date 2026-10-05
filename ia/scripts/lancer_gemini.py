"""Remplit le cache des appels Gemini utilisé par le notebook.
   GEMINI_API_KEY=... python ia/scripts/lancer_gemini.py [texte|audio|reel] [modele] [pause_s]
   (reel = vraies notes vocales importées par scripts/importer_enregistrements.py)
Relançable sans surcoût : les vignettes déjà réussies sont sautées.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vihepat_ia.gemini import evaluer  # noqa: E402

IA = Path(__file__).resolve().parents[1]
modalite = sys.argv[1] if len(sys.argv) > 1 else "texte"
modele = sys.argv[2] if len(sys.argv) > 2 else "gemini-3.5-flash-lite"
pause = float(sys.argv[3]) if len(sys.argv) > 3 else 4.0

vignettes = [json.loads(l) for l in (IA / "data" / "vignettes.jsonl").read_text(encoding="utf-8").splitlines()]
dossier_audio = IA / "data" / "audio"
if modalite == "audio":
    ids = {p.stem for p in dossier_audio.glob("*.webm")}
    vignettes = [v for v in vignettes if v["id"] in ids]
elif modalite == "reel":
    # Vraies voix (fon, français) : une entrée par fichier, identifiée par son nom (ex. fon_L1_V066)
    dossier_audio = IA / "data" / "enregistrements" / "audio"
    manifeste = json.loads((IA / "data" / "enregistrements" / "manifeste.json").read_text(encoding="utf-8"))
    vignettes = [{"id": m["fichier"]} for m in manifeste]

evaluer(vignettes, modele, IA / "resultats" / f"{modele}__{modalite}.jsonl",
        modalite="audio" if modalite == "reel" else modalite, dossier_audio=dossier_audio, pause_s=pause)
