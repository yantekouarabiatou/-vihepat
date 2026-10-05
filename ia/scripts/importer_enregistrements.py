"""Importe les vraies notes vocales (fon, français) dans le format de l'application.
   python ia/scripts/importer_enregistrements.py [dossier_brut]
Par défaut : ia/data/enregistrements/brut/  (tous formats : .ogg .opus .m4a .mp3 .wav .aac .amr .webm)
Nom attendu : <langue>_<locuteur>_<ID>.<ext>   ex. fon_L1_V066.ogg, fr_L2_V003.m4a
Sortie : ia/data/enregistrements/audio/<même nom>.webm (WebM/Opus 24 kb/s mono) + manifeste.json.
Nécessite ffmpeg (présent sur Colab ; sous Windows : winget install Gyan.FFmpeg).
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

IA = Path(__file__).resolve().parents[1]
DOSSIER = IA / "data" / "enregistrements"
brut = Path(sys.argv[1]) if len(sys.argv) > 1 else DOSSIER / "brut"
sortie = DOSSIER / "audio"
sortie.mkdir(parents=True, exist_ok=True)

ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
if not (ffmpeg and ffprobe):
    sys.exit("ffmpeg introuvable : installez-le (Windows : winget install Gyan.FFmpeg ; Colab : déjà présent).")

ids = {json.loads(l)["id"] for l in (IA / "data" / "vignettes.jsonl").read_text(encoding="utf-8").splitlines()}
NOM = re.compile(r"^(fon|fr)_(L\d{1,2})_(V\d{3})$", re.IGNORECASE)
EXT = {".ogg", ".opus", ".m4a", ".mp3", ".wav", ".aac", ".amr", ".webm", ".mp4", ".3gp", ".flac"}

manifeste_f = DOSSIER / "manifeste.json"
manifeste = {m["fichier"]: m for m in json.loads(manifeste_f.read_text(encoding="utf-8"))} if manifeste_f.exists() else {}
refus = []
for f in sorted(brut.glob("*")):
    if f.suffix.lower() not in EXT:
        continue
    m = NOM.match(f.stem)
    if not m or m.group(3).upper() not in ids:
        refus.append(f.name)
        continue
    langue, locuteur, vid = m.group(1).lower(), m.group(2).upper(), m.group(3).upper()
    nom = f"{langue}_{locuteur}_{vid}"
    cible = sortie / f"{nom}.webm"
    subprocess.run([ffmpeg, "-loglevel", "error", "-y", "-i", str(f), "-ac", "1", "-c:a", "libopus", "-b:a", "24k", str(cible)],
                   check=True)
    duree = float(subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration",
                                  "-of", "csv=p=0", str(cible)], capture_output=True, text=True).stdout.strip() or 0)
    manifeste[nom] = {"fichier": nom, "vignette": vid, "langue": langue, "locuteur": locuteur,
                      "duree_s": round(duree, 1), "source": f.suffix.lower()}

manifeste_f.write_text(json.dumps(sorted(manifeste.values(), key=lambda m: m["fichier"]), ensure_ascii=False, indent=1),
                       encoding="utf-8")
par_langue = {}
for m in manifeste.values():
    par_langue[m["langue"]] = par_langue.get(m["langue"], 0) + 1
print(f"{len(manifeste)} enregistrement(s) au total : {par_langue}")
if refus:
    print(f"⚠️ {len(refus)} fichier(s) ignoré(s), nom invalide (attendu fon_L1_V066.ogg) : {', '.join(refus)}")
courts = [m["fichier"] for m in manifeste.values() if m["duree_s"] < 2]
if courts:
    print(f"⚠️ moins de 2 s, à vérifier : {', '.join(courts)}")
