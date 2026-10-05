"""Choisit les messages à enregistrer par de vraies voix (fon et français) et écrit la fiche des locuteurs.
   python ia/scripts/preparer_enregistrements.py
Sorties : ia/data/enregistrements/FICHE.md (à imprimer) et selection.json.
Sélection reproductible (graine fixe) : 10 messages par niveau, répartis sur tous les types.
"""
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

IA = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(IA))
from vihepat_ia.triage_rules import niveau_depuis_extraction  # noqa: E402

PAR_NIVEAU = 10
LIB_SYMPT = {"fievre": "fièvre", "toux": "toux", "diarrhee": "diarrhée", "nausees": "nausées / vomissements",
             "eruption": "boutons sur la peau", "jaunisse": "yeux ou peau jaunes", "douleur_ventre": "mal au ventre",
             "fatigue": "grande fatigue", "maux_tete": "mal à la tête", "amaigrissement": "perte de poids",
             "urines_foncees": "urines foncées", "autre": "autre symptôme (voir phrase)"}
LIB_GRAVE = {"respiration": "du mal à respirer", "poitrine": "douleur forte dans la poitrine",
             "confusion": "confusion / somnolence / nuque raide", "vomit_traitement": "vomit son traitement",
             "saignement": "saigne beaucoup", "malaise": "malaise / perte de connaissance",
             "idees_noires": "idées de se faire du mal"}
LIB_DUREE = {"aujourdhui": "depuis aujourd'hui (ou hier)", "quelques_jours": "depuis 2 à 7 jours",
             "plus_semaine": "depuis plus d'une semaine", "inconnue": "NE PAS dire de durée"}
LIB_INT = {"leger": "léger, ça va", "gene": "ça gêne", "fort": "très fort, ne peut plus rien faire",
           "inconnue": "NE PAS dire l'intensité"}

vignettes = [json.loads(l) for l in (IA / "data" / "vignettes.jsonl").read_text(encoding="utf-8").splitlines()]
groupes = defaultdict(lambda: defaultdict(list))
for v in vignettes:
    groupes[niveau_depuis_extraction(v, v["traitement_recent"])][v["cat"]].append(v)

alea = random.Random(20261005)
choix = []
for niveau in ["alerte", "a_surveiller", "banal"]:
    cats = groupes[niveau]
    for liste in cats.values():
        alea.shuffle(liste)
    # Tourniquet sur les types de message pour en couvrir le plus possible
    pris, ordre = [], sorted(cats)
    while len(pris) < PAR_NIVEAU and any(cats.values()):
        for c in ordre:
            if cats[c] and len(pris) < PAR_NIVEAU:
                pris.append(cats[c].pop())
    choix += [(niveau, v) for v in pris]

sortie = IA / "data" / "enregistrements"
sortie.mkdir(parents=True, exist_ok=True)
(sortie / "selection.json").write_text(json.dumps([v["id"] for _, v in choix], indent=0), encoding="utf-8")

lignes = ["# Fiche d'enregistrement VIHEPAT", "",
          "Pour chaque message : **dites le contenu avec vos mots**, naturellement, comme un patient au téléphone.",
          "- En **français** : vous pouvez lire la phrase telle quelle (c'est mieux pour mesurer la transcription).",
          "- En **fon** : traduisez **toute** la phrase, y compris les négations (« je n'ai pas de fièvre ») et les "
          "détails hors sujet (« mon frère s'est évanoui ») : ce sont des pièges volontaires pour l'IA.",
          "- La colonne « à garder » sert à vérifier que le sens n'a pas changé : tout y est dit, et aucun symptôme, "
          "durée ou intensité n'est ajouté (si c'est marqué « NE PAS dire », ne le précisez pas).",
          "- Nom du fichier : `<langue>_<locuteur>_<ID>`, par ex. `fon_L1_V066.ogg`, `fr_L2_V066.m4a`.",
          "- 5 à 20 secondes, endroit calme ou normal (le bruit de la vie courante est accepté, c'est réaliste).",
          "- Aucun vrai nom, aucune vraie information de santé : ce sont des messages fictifs.", "",
          "| # | ID | Niveau attendu | Phrase française | À garder dans la version fon |", "|---|---|---|---|---|"]
for n, (niveau, v) in enumerate(choix, 1):
    garder = [", ".join(LIB_SYMPT[s] for s in v["symptomes"]) or "aucun symptôme",
              LIB_DUREE[v["duree"]], LIB_INT[v["intensite"]]]
    if v["signes_graves"]:
        garder.append("⚠️ " + ", ".join(LIB_GRAVE[g] for g in v["signes_graves"]))
    if v["traitement_recent"]:
        garder.append("(contexte : traitement récent, pas besoin de le dire)")
    lignes.append(f"| {n} | {v['id']} | {niveau} | {v['texte']} | {' · '.join(garder)} |")
(sortie / "FICHE.md").write_text("\n".join(lignes) + "\n", encoding="utf-8")
print(f"{len(choix)} messages sélectionnés -> {sortie / 'FICHE.md'}")
