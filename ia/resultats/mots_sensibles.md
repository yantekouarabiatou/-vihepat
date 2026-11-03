# Veille des mots sensibles : évaluation (2026-11-03)

Jeu figé `ia/data/mots_sensibles_test.jsonl` : 50 messages à signaler, 40 messages à ne pas signaler (dont pièges : négations, « mourir de rire », dates et nombres).

| Catégorie | Signalés à l'équipe | Bonne catégorie |
|---|---|---|
| detresse | 11/12 | 11/12 |
| traitement | 10/12 | 10/12 |
| injure | 10/10 | 10/10 |
| stigmatisation | 8/8 | 8/8 |
| coordonnees | 8/8 | 8/8 |

- Messages à signaler effectivement signalés (rappel global) : 47/50
- Messages anodins signalés à tort (fausses alertes) : 6/40

Erreurs :

- MANQUÉ D11 (attendu detresse) Je n'ai plus la force, je veux que tout s'arrête.
- MANQUÉ T09 (attendu traitement) On peut guérir de l'hépatite avec des plantes, pas besoin du docteur.
- MANQUÉ T10 (attendu traitement) Arrête ton traitement pendant le carême, ça ne fait rien.
- FAUSSE ALERTE N03 [detresse : mourir] Mon fils m'a fait mourir de rire ce matin.
- FAUSSE ALERTE N04 [traitement : arrete mon traitement] Je n'ai pas arrêté mon traitement, je tiens bon.
- FAUSSE ALERTE N10 [stigmatisation : punition de dieu] Ne dites pas que c'est une punition de Dieu, c'est une maladie comme une autre.
- FAUSSE ALERTE N18 [detresse : mourir] J'ai eu peur de mourir au début, maintenant je vis bien.
- FAUSSE ALERTE N36 [traitement : les arv tuent] Les rumeurs disent que les ARV tuent, mais c'est faux.
- FAUSSE ALERTE N37 [injure : idiot] Ce film était idiot mais drôle.
