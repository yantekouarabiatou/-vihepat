# VIHEPAT : audit IA responsable

Audit du 3 novembre 2026, sur la branche `feat/circuit-soignant` (commit `3ac89c6`) et la production
https://vihepat.secourseducatif.com. Une exigence n'est « conforme » que si une preuve est citée.

## Contexte retenu

| | |
|---|---|
| Objectif | Suivi des patients VIH et hépatites B/C au Bénin : traitement, rappels, signalement de symptômes, lien avec l'équipe soignante |
| Utilisateurs | Patients, soignants (médecin, infirmier…), super administrateur |
| Système | Mixte : règles de triage déterministes alimentées par Gemini 3.5 Flash-Lite (extraction en champs fermés) ; transcription ElevenLabs Scribe v2 ; régression logistique de perte de suivi ; listes de mots sensibles ; assistant conversationnel Gemini |
| Données | Données de santé (pathologie, symptômes, bilans) ; entraînement sur la cohorte publique LUTH (Nigeria, 2010-2014) ; évaluation sur 165 messages fictifs et 60 notes vocales (42 de synthèse, 18 réelles) |
| Pire échec | Une alerte grave (saignement, détresse, intolérance au traitement) classée « banale » |
| Langues | Français ; fon (interface seulement, analyse vocale volontairement désactivée) |
| Stack | Node 22 / Express / Sequelize / MySQL ; React 19 / Vite ; Python (scikit-learn) pour l'entraînement ; hébergement LWS cPanel |

## 1. Synthèse

Le projet est **partiellement conforme**. La fiabilité du triage est sérieusement mesurée (intervalles de confiance, sous-triage, comparaison à des méthodes de référence), mais uniquement sur des données fictives, et la sécurité est insuffisante.

Les trois risques les plus graves pour un patient :

1. **Une alerte grave manquée** : 2,4 % de sous-triage et un rappel de 4 saignements sur 6, mesurés sur 165 messages écrits par l'équipe. Aucune validation sur de vrais messages ni par des médecins.
2. **Une fuite de statut VIH** : la production mélange comptes de démonstration et comptes réels, des comptes partagent un mot de passe connu (dont un administrateur), et 11 vulnérabilités « hautes » touchaient les dépendances au 3 novembre.
3. **Un score de perte de suivi transposé** : appris au Nigeria (2010-2014) et non recalibré, il classe « faible » des patients dont 31 % ont été perdus de vue dans la cohorte d'origine.

## 2. Tableau d'audit

Gravité : **critique** (peut nuire directement à un patient ou exposer ses données), **majeure**, **mineure**.

### 2.1 Cadre général (NIST AI RMF)

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| 7 propriétés d'une IA de confiance | Partiel | `docs/ETHIQUE.md`, `ia/RESULTATS.md` | Valide et explicable : oui. Sécurisé : non (sections 2.7 et 2.8). Équitable : non mesuré pour le triage | Majeure |

### 2.2 Fiabilité

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Usage et pire échec écrits | Conforme | `docs/ETHIQUE.md` (« oriente, ne diagnostique pas », erreurs asymétriques) | — | — |
| Jeu de test indépendant, avec cas critiques et négatifs | Partiel | Triage : prompt figé avant le test, 70 alertes et 49 banals, aucun exemple dans le prompt. Perte de suivi : découpage 60/20/20, test utilisé une seule fois | Le lexique de la méthode mots-clés a été écrit en connaissant les messages (documenté). Messages rédigés par l'équipe | Majeure |
| Matrice de confusion, précision, rappel, faux positifs | Partiel | Rappel des alertes, sous-triage, sur-triage, kappa pondéré, F1 macro. Perte de suivi : sensibilité, spécificité, VPP, VPN avec intervalles de confiance | *Fait le 3/11 : matrice 3×3 dans `ia/RESULTATS_TRIAGE_MATRICE.md` (1 alerte classée banal sur 70)* | Mineure |
| Métriques adaptées à la santé | Conforme (perte de suivi), Partiel (triage) | Perte de suivi : score de Brier 0,195, courbe de calibration. Triage, **mesure du 3/11** (`ia/RESULTATS_SIGNES_GRAVES.md`, jeu de contrôle figé de 49 messages graves) : union Gemini v2 + lexique, **0/49 alerte ratée** (4/49 avant), 1/21 fausse alerte | Seulement 7 cas par signe sur des messages fictifs : le critère ≥ 95 % sur 20 cas par signe n'est pas encore démontré | Majeure |
| LLM : exactitude, abstention | Partiel | Abstention en fon mesurée (9/9 notes écartées, avec ElevenLabs aussi). **Assistant évalué le 3/11** sur 35 situations : 34/35 conformes après relecture humaine (`ia/resultats/assistant.md`) | Une erreur : vomissement de tous les ARV sur 3 jours classé « modéré » par l'assistant, sans orientation urgente. Échantillon petit | Majeure |
| F1 par classe | Conforme | `ia/RESULTATS_TRIAGE_MATRICE.md` : banal 0,938, à surveiller 0,936, alerte 0,957 | — | — |
| Comparaison à un modèle trivial, seuil fondé sur les coûts | Partiel | Perte de suivi : référence naïve, seuil choisi pour 80 % de sensibilité. Triage : comparé aux mots-clés et à TF-IDF | *Fait le 3/11 : « toujours alerte » (= classe majoritaire) obtient un F1 macro de 0,199 contre 0,944* | — |

Résultats de référence (`ia/RESULTATS.md`, 165 messages fictifs, intervalles de confiance à 95 %) :

| Méthode | Exactitude | Rappel des alertes | Sous-triage | Sur-triage |
|---|---|---|---|---|
| Gemini + règles (production) | 0,945 [0,91–0,98] | 0,957 | 0,024 | 0,030 |
| Mots-clés + règles | 0,867 [0,81–0,92] | 0,871 | 0,073 | 0,061 |
| TF-IDF + régression logistique | 0,667 [0,59–0,74] | 0,771 | 0,145 | 0,188 |

Perte de suivi (`ia/perte_de_suivi/README.md`, 1 219 patients de test) : AUC ROC 0,765 [0,738–0,789], sensibilité 81 %, VPP 69 %.

### 2.3 Robustesse

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Dérive (données récentes) | Non conforme | — | Aucune donnée récente ni béninoise, ni pour le score ni pour le triage | Majeure |
| Bruit et champs manquants | Partiel | Messages bruités : 0,93. Perte de suivi : examens manquants gérés et mesurés | Pas de test de saisie erronée dans les formulaires | Mineure |
| Variantes (fautes, langues mélangées) | Partiel | Négations 1,00 ; langage familier 0,90 ; lexique du français parlé au Bénin | Mélange fon-français non mesuré. *Mots sensibles évalués le 3/11 : 47/50 signalés, 6/40 fausses alertes (négations non gérées)* | Majeure |
| Hors périmètre et abstention | Conforme | Fon détecté (9/9) donc aucun pré-remplissage. Score réservé au VIH. Pas de score sans bilan d'inclusion | — | — |
| Stress test sur corpus figé | Partiel | Voix de synthèse : 4,9 % de mots mal transcrits, exactitude identique au texte | Pas de protocole de perturbations graduées | Mineure |
| Garde-fous | Conforme | Délai de 20 s, modèle de secours, bascule ElevenLabs vers Gemini, limites de requêtes, rejet de toute sortie hors schéma | — | — |
| Mode dégradé | Conforme | Formulaire à pictogrammes, triage hors ligne, consigne d'urgence immédiate, score masqué si le calcul porté diverge de scikit-learn | — | — |

### 2.4 Responsabilité

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Confidentialité | Partiel | Rappels gardés sur l'appareil, e-mails sans détail médical, expéditeur neutre, pseudonymes HMAC dans les groupes, journaux sans contenu de santé | Les objets d'e-mail de bienvenue et de nouveaux identifiants contenaient « VIHEPAT » : *corrigés le 3/11 (objet et expéditeur neutres), à déployer*. L'audio part vers deux services externes | Majeure |
| Équité par groupe et langue | Non conforme (triage), Conforme (perte de suivi) | Perte de suivi : section 12 du notebook | Triage : un seul locuteur réel, aucune mesure par sexe, âge ou région | Majeure |
| Décision humaine, incertitude affichée | Partiel | Le patient relit la transcription ; le soignant décide ; le score affiche sa probabilité et le taux observé par niveau | Pas de liste formelle des cas à escalader. Incertitude du triage non affichée | Mineure |
| Redevabilité | Partiel | Le journal d'audit trace qui consulte et qui traite | Aucun responsable clinique nommé ; règles non validées par un médecin | Majeure |

### 2.5 Données personnelles

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Minimisation | Partiel | Le soignant ne voit des rappels que des compteurs | Le bilan d'inclusion collecte 13 champs dont l'utilité au Bénin n'est pas démontrée | Mineure |
| Pseudonymisation | Conforme (groupes), Partiel (ailleurs) | `backend/src/services/pseudonyme.service.ts` (HMAC à clé secrète) | Les initiales dans le pseudonyme réduisent l'anonymat dans un petit groupe | Mineure |
| Anonymisation | Sans objet | — | Aucune revendication d'anonymat | — |
| Données synthétiques en démo | **Non conforme** | — | La production mélange comptes de démonstration (`@example.com`) et comptes réels, avec un mot de passe connu | **Critique** |

### 2.6 Juge LLM

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Calibration du juge, kappa | Sans objet | Aucun juge LLM : les évaluations comparent à des annotations humaines | Les annotations n'ont pas été relues par une seconde personne (pas de kappa entre annotateurs) | Majeure |

### 2.7 Sécurité du contenu externe

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Test du « document piégé » | Partiel | **6 tentatives d'injection testées le 3/11** (ordre caché, faux « mode administrateur », demande des consignes internes, instruction cachée entre crochets) : aucun signalement créé, aucune consigne divulguée (`ia/resultats/assistant.md`) | Seulement 6 cas, dans le message lui-même ; pas de test sur un contenu externe piégé | Mineure |
| Menaces couvertes | Partiel | Schéma fermé et validation zod, clés côté serveur, CORS, en-têtes de sécurité (Helmet) | Sessions gardées dans le stockage local du navigateur (exposées en cas de faille XSS). *Corrigé dans l'audit : l'inscription patient est bien fermée, `POST /api/auth/register/patient` renvoie 403 (vérifié en production le 3/11)* | Majeure |
| Contenu externe traité comme non fiable | Partiel | Sortie contrainte par un schéma pour le triage | Le texte libre du chat n'est ni délimité ni filtré | Majeure |

### 2.8 Chaîne logicielle

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Rien d'exposé sans authentification | Partiel | Routes patient, soignant et admin protégées | `/api/chat` et `/api/chat/transcrire` ouverts aux visiteurs (avec limite de requêtes) | Mineure |
| Dépendances épinglées et scannées | Partiel | `npm audit --omit=dev` du 3/11/2026, **après correction** : API 0 haute, 2 modérées (`uuid` dans Sequelize, non exploitable : Sequelize ne passe pas de tampon) ; site 0 vulnérabilité. Corrections : zod 4 dans l'API, `shadcn` déplacé dans les outils de développement, vite 8.3.5, zod inutilisé retiré du site. Avant : API 2 hautes + 4 modérées, site 9 hautes + 8 modérées | Versions en `^` ; aucun scan automatique. *zod 4 actif en production depuis le 3/11 (embarqué dans `dist/node_modules`, vérifié par son format d'erreur)* | Majeure |
| Aucun secret dans le code ni l'historique | Partiel | Recherche dans tout l'historique git : 0 occurrence des secrets connus. Fichiers `.env` non suivis | gitleaks non exécuté. Mot de passe FTP et deux clés ElevenLabs échangés en clair pendant le développement, non régénérés | **Critique** |
| Moindre privilège | Partiel | Permissions par rôle, modifiables | Le médecin a désormais un accès global ; un seul compte FTP sert à tout | Mineure |
| Analyse de code et de modèles | Non conforme | — | Ni semgrep, ni bandit ; `ltfu_modele_final.joblib` (format pickle) non scanné | Mineure |

### 2.9 Traçabilité et preuves

| Exigence | Statut | Preuve | Écart | Gravité |
|---|---|---|---|---|
| Versions et paramètres conservés | Conforme | Prompt versionné (`extraction-v1`), modèles épinglés, température 0, seuils dans `perte-de-suivi.modele.json`, empreinte SHA-256 des données, graine 42, `ia/data/enregistrements/manifeste.json` | — | — |
| Documentation des échecs | Conforme | Fon à 0/9, les 4 sous-triages listés, limites détaillées | Évaluations ajoutées à `ia/RESULTATS.md` le 3/11 ; `docs/IA.md` reste à mettre à jour (ElevenLabs, mots sensibles, assistant) | Mineure |
| Explication des décisions | Conforme | Chaque alerte a ses raisons ; le score montre ses facteurs ; un signalement indique les mots détectés | — | — |
| Reproductibilité outillée | Partiel | `docker-compose.yml`, `requirements.txt`, notebooks réexécutables, script d'export vérifié (`exporter_modele_node.py`) | Pas de MLflow, DVC ni Make ; déploiement manuel par FTP | Mineure |

## 3. Preuves manquantes

- [x] Matrice de confusion 3×3 et F1 par classe du triage (`ia/RESULTATS_TRIAGE_MATRICE.md`)
- [x] Évaluation de l'assistant conversationnel : 35 situations, 34/35 après relecture (`ia/resultats/assistant.md`)
- [x] Évaluation d'ElevenLabs sur les 18 vraies notes (`ia/resultats/elevenlabs__reel.md`)
- [x] Détection de mots sensibles sur 90 messages annotés (`ia/resultats/mots_sensibles.md`)
- [ ] Double annotation des messages de test, avec le kappa entre annotateurs
- [ ] Palier des API en production (Gemini gratuit ou payant) et conditions de conservation des données chez ElevenLabs
- [ ] Inventaire des comptes de production : réels ou de démonstration

## 4. Plan de correction priorisé

| Priorité | Action | Outil | Critère de réussite |
|---|---|---|---|
| Critique | Séparer la démo de la production ; changer tous les mots de passe de démonstration | phpMyAdmin, page Administration | 0 compte avec un mot de passe partagé ; démo sur une base distincte |
| Critique | Régénérer le mot de passe FTP et les clés ElevenLabs | cPanel LWS, console ElevenLabs | Anciennes valeurs refusées |
| Fait (3/11) | Corriger les vulnérabilités hautes : 0 haute dans l'API et le site, zod 4 actif en production | `npm audit fix`, zod 4 ; puis Dependabot | 0 vulnérabilité haute ou critique en production |
| En cours (3/11) | Rappel des signes graves : prompt v2 + lexique v2 en union, 0/49 alerte ratée sur un jeu de contrôle figé ; reste à élargir à 20 cas par signe, idéalement écrits par d'autres personnes | `backend/scripts/evaluer-signes-graves.ts` | Rappel ≥ 95 % par signe grave, sur au moins 20 cas par signe |
| Majeure | Faire valider les règles de triage par un infectiologue | Grille de relecture signée | Règles approuvées et versionnées |
| Fait | ~~Fermer l'inscription patient publique~~ : déjà fermée, vérifié le 3/11 (403) | — | — |
| En cours (3/11) | Tester l'injection de consigne sur le chat : 6/6 tentatives sans effet ; à étendre à 20 messages et à un contenu externe piégé | `backend/scripts/evaluer-assistant.ts` | 0 signalement créé à la demande d'une consigne cachée |
| Majeure | Retirer « VIHEPAT » des objets d'e-mail patient | `backend/src/services/mail.service.ts` | Objet neutre vérifié sur les 3 types d'e-mail patient |
| Majeure | Recalibrer le score de perte de suivi sur des données béninoises, ou l'afficher comme expérimental | Protocole + régression sur données locales | Calibration (Brier) mesurée sur au moins 200 patients locaux |
| Majeure | Mesurer l'équité du triage | 5 locuteurs ou plus, par sexe et région, double annotation | Écart d'exactitude entre groupes < 10 points |
| Mineure | gitleaks et semgrep à chaque push ; modelscan sur le `.joblib` | GitHub Actions | Contrôles verts sur chaque pull request |
| Mineure | Épingler les versions et scripter le déploiement | Lockfile, script de déploiement | Construction reproductible |

## 5. Verdict

**Non prêt pour un usage avec de vrais patients.** La démarche de mesure est solide et honnête : intervalles de confiance, échecs documentés, abstention en fon, garde-fous et humain dans la boucle. Quatre conditions bloquent encore :

1. les performances n'ont jamais été mesurées sur de vraies données ;
2. aucune règle n'a été validée par un médecin ;
3. la sécurité de la production n'est pas au niveau d'une application qui contient des statuts VIH (mots de passe partagés, secrets à régénérer) ;
4. le score de perte de suivi n'est pas recalibré sur des patients béninois.

Le projet est **présentable en finale comme preuve de concept**, à condition d'exposer clairement ces limites.
