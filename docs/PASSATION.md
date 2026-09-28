# VIHEPAT — Document de Passation & Guide Technique

Mise à jour complète : **28/09/2026**  
Branche de travail : `feat/circuit-soignant` (synchronisée et compatible Lovable)

---

## 1. Démarrer en local

### Prérequis
* **Node.js** v20+ ou v22
* **MySQL** (via XAMPP port `3306`, ou Docker Compose `docker compose up -d` → port `3309`)

```bash
# 1. Backend (Terminal 1)
cd backend
cp .env.example .env          # Ajuster DB_PORT, DB_USER, DB_PASS si besoin
npm install                   # ⚠️ Ne jamais exécuter « npm audit fix --force »
npm run db:migrate            # Applique les migrations Sequelize
npm run db:seed               # Crée les structures, comptes démo et données cliniques
npm run dev                   # API disponible sur http://localhost:4000

# 2. Frontend (Terminal 2)
cd frontend
cp .env.example .env
npm install
npm run dev                   # Interface disponible sur http://localhost:5173
```

---

## 2. Identifiants de connexion (Comptes de Démo)

> **Mot de passe universel pour tous les comptes démo** : `Password123!`

### A. Administrateur Global
| Identifiant (Email) | Mot de passe | Rôle | Périmètre d'accès |
|---|---|---|---|
| `admin@vihepat.org` | `Password123!` | `admin` | Accès complet : tableau de bord d'administration (`/admin`), gestion des structures, gestion des utilisateurs et permissions, consultation des logs d'audit. |

---

### B. Équipe Soignante
| Identifiant (Email) | Mot de passe | Structure / Spécialité |
|---|---|---|
| `aicha.kouassi@vihepat.org` | `Password123!` | CHU Cotonou — Infectiologie (Matricule : `SEED-MED-001`) |
| `jean.houngbo@vihepat.org` | `Password123!` | Hôpital de Zone Abomey-Calavi — Médecine générale (`SEED-MED-002`) |

#### Codes d'invitation soignant (pour inscription d'un nouveau soignant) :
* **Code par défaut global** : `VIHEPAT-SOIGNANT-2026`
* **CHU Cotonou** : `CHU-COTONOU-2026`
* **Hôpital de Zone Abomey-Calavi** : `HZ-ABCALAVI-2026`
* **Centre de Santé Parakou** : `CS-PARAKOU-2026`

---

### C. Patients de Démo
Les patients peuvent se connecter avec leur **Email** OU leur **Code Patient** :

| Nom & Prénom | Identifiant (Email) | Code Patient | Pathologie | Profil clinique |
|---|---|---|---|---|
| **Awa Mensah** | `awa.mensah@example.com` | `VHP-2026-100001` | VIH-1 | Observance régulière (95%), charge virale indétectable. |
| **Kofi Agossou** | `kofi.agossou@example.com` | `VHP-2026-100002` | VHB | Suivi hépatite B chronique. |
| **Fatou Diallo** | `fatou.diallo@example.com` | `VHP-2026-100003` | VHC | Suivi hépatite C sous Sofosbuvir. |
| **Espoir Dossou** | `espoir.dossou@example.com` | `VHP-2026-100004` | Co-infection VIH / VHB | Suivi combiné Littoral Cotonou. |
| **Grâce Adjovi** | `grace.adjovi@example.com` | `VHP-2026-100005` | VIH | Décrochage d'observance (40%), signalement sévère récent. |
| **Marcel Tossou** | `marcel.tossou@example.com` | `VHP-2026-100006` | Co-infection VHB / VHC | Suivi Parakou. |

---

## 3. Fonctionnalités récentes ajoutées

### 🔐 1. Circuit de création patient & Gestion des Rôles (RBAC)
* **Création sécurisée des patients** : L'inscription libre de patient est désactivée du formulaire public afin de protéger la confidentialité et garantir le suivi médical. Seuls les soignants et administrateurs habilités peuvent créer un dossier patient.
* **Génération de Fiche Patient PDF** :
  * Dès la création d'un patient par un soignant, une fiche PDF nominative et téléchargeable est générée automatiquement (`frontend/src/lib/patient-pdf.ts`).
  * Contient le code patient, l'email, le mot de passe temporaire, les coordonnées de la structure de rattachement et un guide de première connexion.
* **Réinitialisation des accès patient** :
  * Endpoint backend sécurisé `POST /patients/:id/reinitialiser-acces` avec audit logging.
  * Bouton « Réinitialiser l'accès » accessible sur la liste des patients et sur la fiche détaillée (`PatientDetailPage.tsx`).
  * Génère un nouveau mot de passe temporaire et télécharge immédiatement la fiche PDF mise à jour.

### 📊 2. Export du Répertoire Patient
* Bouton d'exportation présent sur l'espace soignant (`frontend/src/features/soignant/PatientsPage.tsx`).
* Export complet en **CSV / Excel** de la patientèle avec filtrage, incluant code patient, pathologie, statut de suivi, observance, dernière charge virale et coordonnées.

### 💬 3. Chatbot Médical Débloqué pour Tous
* Composant [`chat-widget.tsx`](file:///c:/wamp64/www/Vihepat/frontend/src/components/chat-widget.tsx) déverrouillé et visible sur l'ensemble de la plateforme (visiteurs publics, patients, soignants).
* **Double moteur** : IA Claude (si clé `ANTHROPIC_API_KEY` configurée) + **Moteur expert médical local de secours** (règles cliniques et base de connaissances VIH/hépatites) fonctionnant 100% hors-ligne.
* **Accessibilité intégrée** :
  * Dictée vocale au microphone (Speech-to-Text).
  * Synthèse vocale Text-to-Speech pour écouter les réponses à voix haute.
  * Boutons de questions rapides médicales.
  * Bouton de réinitialisation de conversation.

### 🎙️ 4. Enregistrement des Symptômes : Audio, Option « Autre » & Vrais Icônes
* Composant de triage patient [`TriageDialog.tsx`](file:///c:/wamp64/www/Vihepat/frontend/src/features/patient/TriageDialog.tsx) complètement modernisé :
  * **Vrais icônes médicaux vectoriels Lucide** : Remplacement des émojis par des icônes représentatives avec codes couleurs dédiés (`Thermometer`, `Wind`, `Activity`, `Frown`, `Sparkles`, `Eye`, `HeartCrack`, `BatteryLow`, `Brain`, `TrendingDown`, `Droplets`, `PlusCircle`).
  * **Option « Autre symptôme »** : Déploiement d'un volet dédié avec zone de texte multiligne (`Textarea`) pour décrire librement ses symptômes.
  * **Option Audio complète** :
    * **Dictée vocale directe (Speech-to-Text)** : Retranscription en direct dans la zone de texte avec indicateur animé de parole.
    * **Enregistrement de note vocale (MediaRecorder)** : Enregistrement de message vocal avec chronomètre, lecteur de réécoute et option de suppression.
    * **Synthèse vocale (Text-To-Speech)** : Boutons d'écoute audio sur chaque consigne pour les patients analphabètes ou affaiblis.
    * Prise en compte de la note vocale dans la synthèse transmise à l'équipe soignante (`frontend/src/lib/triage.ts`).

### 🌐 5. Amélioration de l'Expérience & Navigation
* **Bouton « Site public »** intégré directement sur le Dashboard Patient pour naviguer vers les ressources publiques sans se déconnecter.
* **Sidebar Soignant** : Liens directs vers la création de patient, la liste complète, le tableau de bord, les alertes et les communiqués.

### 📧 6. Notifications par Email (Relais SMTP Brevo)
* **Configuration SMTP active** intégrée dans `backend/.env` et [`mail.service.ts`](file:///c:/wamp64/www/Vihepat/backend/src/services/mail.service.ts) :
  * Relais : `smtp-relay.brevo.com:587` (TLS)
  * Expéditeur : `rabiatouyantekoua@gmail.com` (« VIHEPAT Santé »)
* **Emails transactionnels automatiques envoyés (HTML soigné et responsive)** :
  1. **Bienvenue Patient** : Envoi immédiat des identifiants (Code Patient, Email, Mot de passe temporaire) dès la création du dossier par le soignant.
  2. **Réinitialisation d'Accès Patient** : Envoi du nouveau mot de passe temporaire dès réinitialisation par l'équipe soignante.
  3. **Bienvenue Soignant** : Confirmation d'activation du compte avec rattachement à sa structure de santé.
  4. **Alerte Médicale Critique** : Notification d'urgence envoyée directement au médecin référent lorsqu'un patient déclare un symptôme grave ou de sévérité élevée.
* *Note Brevo* : Si Brevo renvoie `525 5.7.1 Unauthorized IP address`, autorisez l'adresse IP publique de votre connexion ou désactivez la restriction IP dans le compte Brevo (*Paramètres SMTP & API > IPs autorisées*).

---

## 4. Couverture des 5 Piliers du Cahier de Cadrage

| Pilier | Statut | Réalisations |
|---|:---:|---|
| **1. Observance et rappels** | ✅ | Prises du jour (Pris / Oublié), score 7j / 30j, série en cours, alertes examens biologiques (CV, CD4, transaminases), rappels neutres, demande de RDV. |
| **2. IA embarquée & Mode hors-ligne** | ✅ | Moteur de triage expert à règles embarqué (`triage.ts`), PWA installable avec Service Worker, file d'attente hors-ligne (`offline-queue.ts`), chatbot universel avec fallback local. |
| **3. Discrétion et séparation des rôles** | ✅ | RBAC strict (Admin / Soignant / Patient), audit des accès médicaux, mode discret (masquage des pathologies), code PIN local et verrouillage automatique. |
| **4. Langues locales et pairs** | ✅ | Support multilingue i18n Français / Anglais / Fon, synthèse vocale intégrée pour l'accessibilité orale, groupes de pairs / soutien communautaire. |
| **5. Déploiement & Architecture** | ✅ | Docker Compose MySQL, Dockerfile API et Frontend, scripts de migrations et seed, conformité TypeScript stricte. |

---

## 5. Architecture des Fichiers Clés

```
Vihepat/
├── backend/
│   ├── src/
│   │   ├── config/             # database.ts, permissions.ts, env.ts
│   │   ├── controllers/        # auth, patient, soignant, admin, chat, groupe
│   │   ├── services/           # Logique métier, observance, audit, PDF
│   │   ├── models/             # Modèles Sequelize (User, Patient, Soignant, etc.)
│   │   ├── routes/             # auth, patient, soignant, admin, chat, groupe
│   │   └── seed.ts             # Données de démonstration et structures
├── frontend/
│   ├── src/
│   │   ├── api/                # Clients API Axios (auth, patient, soignant, admin)
│   │   ├── components/         # chat-widget, soignant-sidebar, listen-button
│   │   ├── features/
│   │   │   ├── auth/           # Connexion, inscription soignant habilité
│   │   │   ├── patient/        # DashboardPage, TriageDialog, ObservanceSection
│   │   │   ├── soignant/       # PatientsPage, PatientDetailPage, DashboardPage
│   │   │   └── admin/          # AdminPage (rôles, structures, audit)
│   │   ├── hooks/              # use-speech-recognition, use-text-to-speech
│   │   ├── lib/                # triage.ts, patient-pdf.ts, offline-queue.ts
│   │   └── i18n/locales/       # fr.json, fon.json, en.json
```

---

## 6. Vérification du Mode Hors-Ligne
1. Ouvrir le site dans Chrome ou Edge (`http://localhost:5173`).
2. Ouvrir les Outils de développement (F12) → Onglet **Application** / **Réseau (Network)** → Choisir **Offline**.
3. Déclarer un symptôme ou cocher une prise de médicament : un bandeau signale la mise en file d'attente locale (`indexedDB` / `localStorage`).
4. Repasser en **Online** : la file d'attente se synchronise immédiatement avec le serveur.
