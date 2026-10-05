# Enregistrements de vraies voix (fon et français)

But : mesurer la fonction vocale sur de **vraies voix béninoises**, et sur le **fon**, au lieu de voix de synthèse. Le jury n'acceptera le fon que s'il est mesuré.

## Qui enregistre
- **Fon** : au moins 2 personnes qui parlent fon couramment, 30 notes chacune (60 notes au total).
- **Français** : au moins 2 personnes, 30 notes chacune, avec leur accent naturel.
- Idéalement hommes et femmes, âges différents. Une même personne peut faire les deux langues.
- Chaque personne reçoit un code : `L1`, `L2`, `L3`… Les noms ne sont écrits nulle part dans le dépôt.

## Quoi dire
Le fichier [`FICHE.md`](FICHE.md) contient les 30 messages, avec pour chacun ce qu'il faut garder. Ce sont des messages **fictifs** : personne ne parle de sa propre santé.
- **Français** : lire la phrase telle quelle, naturellement, sans articuler exagérément.
- **Fon** : dire le même sens, avec ses mots, **toute** la phrase (y compris « je n'ai pas de… » et les détails hors sujet).

## Comment enregistrer
Un téléphone suffit : **note vocale WhatsApp**, ou l'application dictaphone. 5 à 20 secondes par message, un message par fichier. Un endroit normal convient (un peu de bruit de fond est réaliste) ; éviter seulement le vent dans le micro.

## Comment envoyer les fichiers
1. Créer un dossier Google Drive partagé `VIHEPAT_enregistrements` (accès limité à l'équipe).
2. Chaque fichier doit s'appeler `<langue>_<locuteur>_<ID>` + l'extension d'origine :
   `fon_L1_V126.ogg`, `fon_L1_V148.ogg`, `fr_L2_V126.m4a`…
   *Astuce WhatsApp* : envoyer dans un groupe le texte « V126 » puis la note vocale ; la personne qui coordonne télécharge et renomme.
3. La personne qui coordonne copie tout dans `ia/data/enregistrements/brut/` (dossier ignoré par git), puis :
```bash
python ia/scripts/importer_enregistrements.py           # vérifie les noms, convertit en WebM/Opus
python ia/scripts/lancer_gemini.py reel gemini-3.5-flash-lite
python ia/scripts/construire_notebook.py               # puis exécuter le notebook (section 8 bis)
```
Formats acceptés : `.ogg .opus .m4a .mp3 .wav .aac .amr .webm .mp4 .3gp .flac`. Les fichiers mal nommés sont listés et ignorés.

## Après l'évaluation
- Une personne qui parle fon **relit les transcriptions** affichées dans le notebook (section 8 bis) : Gemini peut produire une traduction plausible mais fausse. Noter ses remarques dans le notebook.
- Les **audios ne sont pas versionnés** (ce sont des voix de personnes réelles) ; seuls les résultats (`ia/resultats/*__reel.jsonl`, qui contiennent les transcriptions) et `manifeste.json` le sont.

## Consentement (à faire signer ou valider par écrit, WhatsApp accepté)
> J'accepte d'enregistrer des messages fictifs pour tester l'application VIHEPAT. Je sais que ma voix sera envoyée à Google (API Gemini) pour être transcrite, qu'elle ne sera pas publiée, et que seules les transcriptions de ces messages fictifs figureront dans le dépôt du projet. Je peux retirer mes enregistrements à tout moment.
