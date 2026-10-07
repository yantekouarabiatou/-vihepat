# VIHEPAT : éthique, biais, confidentialité, limites

## Principe

VIHEPAT **oriente**, il ne **diagnostique** pas. L'IA sert à comprendre ce que dit le patient ; la priorité vient de règles écrites, lisibles et vérifiables, et un soignant décide toujours de la suite.

## Garde-fous dans le produit

1. **Le LLM ne décide pas de la priorité** : il remplit un schéma fermé, le moteur de règles décide (chaque alerte est accompagnée de ses raisons).
2. **Humain dans la boucle** : l'analyse vocale *pré-remplit* le formulaire ; le patient voit la transcription et corrige avant d'envoyer. Les signes de gravité restent cochables à la main.
3. **Erreurs asymétriques** : les règles penchent vers le niveau le plus élevé en cas de doute. On accepte du sur-triage (alertes en trop) pour minimiser le sous-triage (alerte manquée), mesuré en priorité dans le notebook.
4. **Toujours une solution sans IA** : hors ligne, sans clé API, ou si Gemini échoue, le formulaire à pictogrammes et le triage embarqué fonctionnent seuls.
5. **Urgences** : les signes de gravité affichent immédiatement la consigne d'aller au centre de santé, sans attendre une réponse du soignant ; les idées suicidaires reçoivent un message spécifique.
6. **Pas de conseil thérapeutique** : aucune modification de traitement n'est proposée.
7. **Langue non comprise = pas de pré-remplissage** : sur nos vraies notes en fon, Gemini reconnaît la langue mais invente des symptômes et ne détecte aucune alerte (0/4, `ia/RESULTATS.md`). Quand la note est détectée en fon (ou autre langue que le français), le triage ne pré-remplit rien et le chatbot n'insère aucun texte : le patient est orienté vers les pictogrammes, et le signalement indique au soignant qu'une note vocale en fon a été laissée.

## Biais identifiés

| Biais | Risque | Ce que nous faisons |
|---|---|---|
| Langue : jeu d'évaluation en français uniquement | l'outil marche moins bien pour les patients qui parlent fon, yoruba, dendi… et peut creuser les inégalités d'accès | le fon n'est **pas revendiqué** tant qu'il n'est pas mesuré ; pictogrammes + lecture à voix haute disponibles pour tous |
| Accent et qualité audio : test fait sur des voix de synthèse fr-FR | erreurs de transcription plus fréquentes sur accents locaux, bruit, téléphones d'entrée de gamme | chiffres audio présentés comme un plafond ; prochaine étape : enregistrements réels de volontaires |
| Données d'évaluation écrites par l'équipe | vocabulaire limité à ce que l'équipe imagine ; risque de sur-estimer les scores | limite écrite dans le notebook ; le lexique du modèle A est signalé comme favorisé |
| Alphabétisation numérique | les patients sans smartphone ou peu à l'aise sont exclus de la fonction | canal soignant (saisie par le soignant) et formulaire simplifié |
| Règles cliniques écrites par l'équipe | seuils non validés par des médecins | validation médicale demandée avant tout usage réel |

## Confidentialité

Le VIH et les hépatites sont des pathologies stigmatisées : une fuite peut exclure socialement un patient.

- **Envoi à un tiers** : l'audio part vers l'API Gemini (Google) **seulement** quand le patient appuie sur « Analyser ». Rien n'est envoyé automatiquement. L'audio n'est pas stocké par VIHEPAT ; seule la transcription rejoint le signalement, comme un texte tapé.
- **Minimisation** : aucun nom, code patient ou identifiant n'est envoyé à Gemini, seulement la voix. (Le patient peut citer son nom dans la note : à rappeler dans l'interface.)
- **Journal de mesures** : `backend/logs/ia-mesures.jsonl` ne contient que latence, tokens, modèle et niveau, sans identifiant ni contenu.
- **Palier gratuit Gemini** : les conditions Google autorisent l'usage des données du palier gratuit pour améliorer leurs produits. **En production, palier payant obligatoire**, et consentement explicite du patient avant la première analyse vocale.
- **Cadre légal** : Code du numérique du Bénin (livre V, données à caractère personnel) ; déclaration à l'APDP (Autorité de Protection des Données à caractère Personnel) avant tout déploiement avec de vrais patients.
- **Clés API** : uniquement côté serveur (`backend/.env`, non versionné), jamais dans le frontend.

## Limites assumées

1. Aucune donnée réelle de patient : performance réelle inconnue.
2. Échantillon de 165 messages, annotation sans double lecture ni médecin.
3. Vraies voix encore peu nombreuses (1 locuteur, 18 notes) ; en fon, aucune méthode testée n'est assez fiable : Gemini seul 0/9, MMS + NLLB-200 3/9 (`docs/IA.md`).
4. Dépendance à un service externe (disponibilité mesurée dans le notebook : surcharges 503 observées pendant les tests).
5. Le moteur de règles n'est pas un dispositif médical validé.

## Ce qu'il faudrait avant un usage réel

- Validation des règles par des infectiologues (CHU, PNLS).
- Évaluation sur des notes vocales réelles de volontaires consentants, dont en fon, avec double annotation.
- Avis de l'APDP et d'un comité d'éthique, consentement éclairé, palier payant ou modèle hébergé localement.
