"""Matrice de confusion 3x3 et métriques par classe du triage (complément de RESULTATS.md, audit IA du 3/11/2026).

Rejoue, sans appeler d'API, les réponses de Gemini déjà enregistrées sur les 165 messages
(resultats/gemini-3.5-flash-lite__texte.jsonl, prompt extraction-v1) et la méthode mots-clés,
puis les compare à deux références triviales. Niveau attendu = règles appliquées à l'annotation.

    python ia/scripts/matrice_triage.py        (depuis la racine du dépôt ; aucune dépendance)
"""
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
from vihepat_ia.baseline_mots_cles import extraire  # noqa: E402
from vihepat_ia.triage_rules import NIVEAUX, evaluer_triage, niveau_depuis_extraction  # noqa: E402

vignettes = [json.loads(l) for l in open(RACINE / 'data/vignettes.jsonl', encoding='utf-8') if l.strip()]
attendu = {v['id']: evaluer_triage(set(v['symptomes']), v['duree'], v['intensite'], v['signes_graves'], v['traitement_recent'])[0]
           for v in vignettes}

# Dernière réponse réussie par message (le fichier garde aussi les essais refusés pour quota)
gemini = {}
for l in open(RACINE / 'resultats/gemini-3.5-flash-lite__texte.jsonl', encoding='utf-8'):
    r = json.loads(l)
    if r.get('ok'):
        gemini[r['id']] = r['extraction']

traitement = {v['id']: v['traitement_recent'] for v in vignettes}
methodes = {
    'C · Gemini 3.5 Flash-Lite + règles (prompt v1)': {i: niveau_depuis_extraction(x, traitement[i]) for i, x in gemini.items()},
    'A · mots-clés + règles': {v['id']: niveau_depuis_extraction(extraire(v['texte']), v['traitement_recent']) for v in vignettes},
    'Référence triviale « toujours alerte »': {v['id']: 'alerte' for v in vignettes},
}
majoritaire = max(NIVEAUX, key=lambda n: sum(1 for a in attendu.values() if a == n))
methodes[f'Référence triviale « classe majoritaire » ({majoritaire})'] = {v['id']: majoritaire for v in vignettes}

NOMS = {'banal': 'banal', 'a_surveiller': 'à surveiller', 'alerte': 'alerte'}
lignes = ['# Triage : matrice de confusion et métriques par classe', '',
          f'Jeu : {len(vignettes)} messages fictifs ({", ".join(f"{NOMS[n]} {sum(1 for a in attendu.values() if a == n)}" for n in NIVEAUX)}). '
          'Lignes = niveau attendu, colonnes = niveau prédit. Généré par `ia/scripts/matrice_triage.py`.', '']
for nom, pred in methodes.items():
    ids = [i for i in attendu if i in pred]
    m = {a: {p: 0 for p in NIVEAUX} for a in NIVEAUX}
    for i in ids:
        m[attendu[i]][pred[i]] += 1
    lignes += [f'## {nom}', '', f'{len(ids)} messages évalués.', '',
               '| attendu \\ prédit | banal | à surveiller | alerte |', '|---|---|---|---|']
    lignes += [f'| **{NOMS[a]}** | ' + ' | '.join(str(m[a][p]) for p in NIVEAUX) + ' |' for a in NIVEAUX]
    lignes += ['', '| Classe | Précision | Rappel | F1 | Effectif |', '|---|---|---|---|---|']
    f1s = []
    for n in NIVEAUX:
        vp = m[n][n]
        predits = sum(m[a][n] for a in NIVEAUX)
        reels = sum(m[n].values())
        prec = vp / predits if predits else 0.0
        rap = vp / reels if reels else 0.0
        f1 = 2 * prec * rap / (prec + rap) if prec + rap else 0.0
        f1s.append(f1)
        lignes.append(f'| {NOMS[n]} | {prec:.3f} | {rap:.3f} | {f1:.3f} | {reels} |')
    exact = sum(m[n][n] for n in NIVEAUX) / len(ids)
    sous = sum(m[a][p] for a in NIVEAUX for p in NIVEAUX if NIVEAUX.index(p) < NIVEAUX.index(a)) / len(ids)
    lignes += ['', f'Exactitude {exact:.3f} · F1 macro {sum(f1s) / 3:.3f} · sous-triage {sous:.3f} '
               f'(dont alerte classée banal : {m["alerte"]["banal"]})', '']

sortie = RACINE / 'RESULTATS_TRIAGE_MATRICE.md'
sortie.write_text('\n'.join(lignes) + '\n', encoding='utf-8')
print('\n'.join(lignes))
