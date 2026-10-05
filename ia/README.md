# Évaluation IA de VIHEPAT

Notebook : [`VIHEPAT_evaluation_IA.ipynb`](VIHEPAT_evaluation_IA.ipynb). Il compare 4 façons de passer d'un message de patient à une priorité d'alerte (banal / à surveiller / alerte) :

| | Modèle | Rôle |
|---|---|---|
| A | Mots-clés + règles | référence sans IA générative, 100 % hors ligne |
| B | TF-IDF + régression logistique | modèle supervisé entraîné sur le jeu (validation croisée) |
| C | Gemini 3.5 Flash-Lite + règles | le LLM extrait des champs, le moteur de règles décide |
| D | Gemini 3.8 Flash + règles | idem avec un modèle plus gros |

Les résultats chiffrés de la dernière exécution sont dans [`RESULTATS.md`](RESULTATS.md).

## Reproduire

### Sur Google Colab
1. Ouvrir `ia/VIHEPAT_evaluation_IA.ipynb` dans Colab (Fichier → Ouvrir un notebook → GitHub).
2. *(Facultatif)* Ajouter la clé dans les secrets Colab sous le nom `GEMINI_API_KEY` (icône 🔑) et passer `REFAIRE_APPELS = True`.
3. Exécution → Tout exécuter. La première cellule clone le dépôt et installe `requirements.txt`.

Sans clé, tous les chiffres sont recalculés à partir des réponses Gemini enregistrées dans `resultats/` : on obtient exactement les mêmes valeurs. Avec une clé, les appels manquants sont refaits (les réponses de Gemini peuvent alors varier légèrement).

> Si le dépôt GitHub est privé, Colab ne pourra pas le cloner : téléverser le dossier `ia/` et `backend/src/ia/extraction.json` à la main, ou rendre le dépôt public.

### En local
```bash
cd ia
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt ipykernel nbclient   # Windows
# source .venv/bin/activate && pip install -r requirements.txt ipykernel nbclient   # Linux / macOS
python scripts/construire_notebook.py          # régénère le .ipynb depuis le script
.venv/Scripts/python -m jupyter nbconvert --to notebook --execute --inplace VIHEPAT_evaluation_IA.ipynb
```

### Ajouter de vraies voix (fon, français)
Voir [`data/enregistrements/README.md`](data/enregistrements/README.md) : fiche à lire, envoi des fichiers, import, consentement.

### Refaire les appels Gemini
```bash
export GEMINI_API_KEY=...        # ne jamais la versionner
python ia/scripts/lancer_gemini.py texte gemini-3.5-flash-lite
python ia/scripts/lancer_gemini.py audio gemini-3.5-flash-lite
python ia/scripts/lancer_gemini.py texte gemini-3.8-flash
python ia/scripts/lancer_gemini.py audio gemini-3.8-flash
```
Relançable : les messages déjà traités sont sautés, chaque échec est journalisé (3 essais max par message).

## Contenu

| Chemin | Rôle |
|---|---|
| `data/vignettes.jsonl` | 165 messages fictifs annotés (voir « Guide d'annotation ») |
| `data/audio/*.webm` | 42 messages lus par 3 voix de synthèse fr-FR, en WebM/Opus (format envoyé par Chrome) |
| `data/enregistrements/` | vraies voix de l'équipe (fon, français) : protocole, fiche des 30 messages, manifeste ; audios non versionnés |
| `data/parite_ts.json` | 5 000 cas évalués par le moteur TypeScript, pour vérifier le portage Python |
| `vihepat_ia/triage_rules.py` | portage Python du moteur de règles de l'application |
| `vihepat_ia/baseline_mots_cles.py` | modèle A |
| `vihepat_ia/gemini.py` | appels Gemini (même prompt que l'application) + cache |
| `resultats/*.jsonl` | toutes les réponses Gemini : brut, latence, tokens, version, erreurs |
| `scripts/` | génération de l'audio, des appels, du notebook |

Le prompt et le schéma ne sont **pas** dupliqués : le notebook lit `backend/src/ia/extraction.json`, le fichier utilisé par l'API.

## Guide d'annotation (rédigé avant les essais)

- **symptomes** : seulement ceux que le patient dit avoir (négations respectées). Hors liste → `autre`.
- **duree** : `aujourdhui` = aujourd'hui, ce matin, cette nuit, hier ; `quelques_jours` = 2 à 7 jours (« une semaine », « la semaine passée ») ; `plus_semaine` = plus de 7 jours, des semaines, des mois ; sinon `inconnue`.
- **intensite** : `leger` = un peu, ça va ; `gene` = ça me gêne, ça me dérange ; `fort` = très fort, insupportable, couché, ne peut plus travailler ; sinon `inconnue` (« beaucoup » seul ne suffit pas).
- **signes_graves** : dits directement ou indirectement (« l'air me manque » → respiration ; « ce serait plus simple de ne plus me réveiller » → idées noires).
- **traitement_recent** : contexte du dossier (traitement commencé il y a moins de 2 mois), donné aux modèles comme l'application le fait.
- Niveau attendu = moteur de règles appliqué à ces champs, avec les valeurs par défaut de l'application (`inconnue` → « aujourd'hui » / « léger »).
