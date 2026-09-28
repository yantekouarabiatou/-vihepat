import bcrypt from 'bcrypt';
import { sequelize } from './config/database';
import {
  User, Patient, Soignant, Affectation,
  Traitement, RendezVous, Observation, Signalement, PriseMedicament,
} from './models';
import { ajouterJours, jourLocal, prisesParJour } from './services/observance.service';

const SALT_ROUNDS = 12;
const SEED_PASSWORD = 'Password123!';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function seedUser(input: {
  email: string; nom: string; prenom: string; role: 'patient' | 'soignant';
}) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  const [user] = await User.findOrCreate({
    where: { email: input.email },
    defaults: { ...input, passwordHash, actif: true },
  });
  return user;
}

async function main() {
  await sequelize.authenticate();
  console.log('✅ MySQL connecté — démarrage du seed');

  // Crée les tables manquantes : le seed peut ainsi être lancé avant l'API
  await sequelize.sync();


  // ---------- Soignants ----------
  const soignantsData = [
    { email: 'aicha.kouassi@vihepat.org', nom: 'Kouassi', prenom: 'Aïcha', matricule: 'SEED-MED-001', structure: 'CHU Cotonou', specialite: 'Infectiologie', telephone: '+229 90 00 00 01' },
    { email: 'jean.houngbo@vihepat.org', nom: 'Houngbo', prenom: 'Jean', matricule: 'SEED-MED-002', structure: 'Hôpital de Zone Abomey-Calavi', specialite: 'Médecine générale', telephone: '+229 90 00 00 02' },
  ];

  const soignants: Soignant[] = [];
  for (const s of soignantsData) {
    const user = await seedUser({ email: s.email, nom: s.nom, prenom: s.prenom, role: 'soignant' });
    const [soignant] = await Soignant.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id, matricule: s.matricule, structure: s.structure,
        specialite: s.specialite, telephone: s.telephone,
      },
    });
    soignants.push(soignant);
  }
  console.log(`✅ ${soignants.length} soignants`);

  // ---------- Patients ----------
  const patientsData = [
    { email: 'awa.mensah@example.com', nom: 'Mensah', prenom: 'Awa', codePatient: 'VHP-2026-100001', pathologie: 'vih' as const, sexe: 'F' as const, region: 'Littoral', commune: 'Cotonou', telephone: '+229 91 00 00 01' },
    { email: 'kofi.agossou@example.com', nom: 'Agossou', prenom: 'Kofi', codePatient: 'VHP-2026-100002', pathologie: 'vhb' as const, sexe: 'M' as const, region: 'Atlantique', commune: 'Abomey-Calavi', telephone: '+229 91 00 00 02' },
    { email: 'fatou.diallo@example.com', nom: 'Diallo', prenom: 'Fatou', codePatient: 'VHP-2026-100003', pathologie: 'vhc' as const, sexe: 'F' as const, region: 'Ouémé', commune: 'Porto-Novo', telephone: '+229 91 00 00 03' },
    { email: 'espoir.dossou@example.com', nom: 'Dossou', prenom: 'Espoir', codePatient: 'VHP-2026-100004', pathologie: 'vih_vhb' as const, sexe: 'M' as const, region: 'Littoral', commune: 'Cotonou', telephone: '+229 91 00 00 04' },
    { email: 'grace.adjovi@example.com', nom: 'Adjovi', prenom: 'Grâce', codePatient: 'VHP-2026-100005', pathologie: 'vih' as const, sexe: 'F' as const, region: 'Zou', commune: 'Abomey', telephone: '+229 91 00 00 05' },
    { email: 'marcel.tossou@example.com', nom: 'Tossou', prenom: 'Marcel', codePatient: 'VHP-2026-100006', pathologie: 'vhb_vhc' as const, sexe: 'M' as const, region: 'Borgou', commune: 'Parakou', telephone: '+229 91 00 00 06' },
  ];

  const patients: Patient[] = [];
  for (const p of patientsData) {
    const user = await seedUser({ email: p.email, nom: p.nom, prenom: p.prenom, role: 'patient' });
    const [patient] = await Patient.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        codePatient: p.codePatient,
        pathologie: p.pathologie,
        sexe: p.sexe,
        region: p.region,
        commune: p.commune,
        telephone: p.telephone,
        languePreferee: 'fr',
        dateNaissance: new Date(1985 + (p.codePatient.length % 15), 3, 12),
        dateDiagnostic: daysFromNow(-400),
        consentementDonne: true,
        dateConsentement: daysFromNow(-400),
      },
    });
    patients.push(patient);
  }
  console.log(`✅ ${patients.length} patients`);

  // ---------- Affectations (répartition des patients entre soignants) ----------
  for (let i = 0; i < patients.length; i++) {
    const soignant = soignants[i % soignants.length]!;
    await Affectation.findOrCreate({
      where: { patientId: patients[i]!.id, soignantId: soignant.id },
      defaults: { patientId: patients[i]!.id, soignantId: soignant.id, principal: true, dateDebut: daysFromNow(-400) },
    });
  }
  console.log('✅ Affectations');

  // ---------- Traitements ----------
  const traitementsParPathologie: Record<string, { molecule: string; dosage: string; frequence: string; heurePrise: string }[]> = {
    vih: [{ molecule: 'Ténofovir/Lamivudine/Dolutégravir', dosage: '300/300/50 mg', frequence: '1x/jour', heurePrise: '20:00' }],
    vhb: [{ molecule: 'Ténofovir disoproxil', dosage: '300 mg', frequence: '1x/jour', heurePrise: '08:00' }],
    vhc: [{ molecule: 'Sofosbuvir/Velpatasvir', dosage: '400/100 mg', frequence: '1x/jour', heurePrise: '08:00' }],
    vih_vhb: [
      { molecule: 'Ténofovir/Lamivudine/Dolutégravir', dosage: '300/300/50 mg', frequence: '1x/jour', heurePrise: '20:00' },
    ],
    vhb_vhc: [{ molecule: 'Sofosbuvir/Velpatasvir', dosage: '400/100 mg', frequence: '1x/jour', heurePrise: '08:00' }],
  };

  for (const patient of patients) {
    const traitements = traitementsParPathologie[patient.pathologie] ?? [];
    for (const t of traitements) {
      const existing = await Traitement.findOne({ where: { patientId: patient.id, molecule: t.molecule } });
      if (!existing) {
        await Traitement.create({
          patientId: patient.id, ...t, dateDebut: daysFromNow(-180), actif: true,
        });
      }
    }
  }
  console.log('✅ Traitements');

  // ---------- Rendez-vous (un passé, un à venir) ----------
  for (const patient of patients) {
    const affectation = await Affectation.findOne({ where: { patientId: patient.id } });
    const soignantId = affectation?.soignantId ?? null;

    const past = await RendezVous.findOne({ where: { patientId: patient.id, statut: 'effectue' } });
    if (!past) {
      await RendezVous.create({
        patientId: patient.id, soignantId, dateHeure: daysFromNow(-30),
        motif: 'Consultation de suivi', statut: 'effectue',
      });
    }
    const upcoming = await RendezVous.findOne({ where: { patientId: patient.id, statut: 'confirme' } });
    if (!upcoming) {
      await RendezVous.create({
        patientId: patient.id, soignantId, dateHeure: daysFromNow(21),
        motif: 'Contrôle biologique trimestriel', statut: 'confirme',
      });
    }
  }
  console.log('✅ Rendez-vous');

  // ---------- Observations (historique sur 12 mois : J-365, J-180, J-30) ----------
  type SerieObs = { type: any; unite: string; valeurs: [number, number, number] };
  const observationsParPathologie: Record<string, SerieObs[]> = {
    vih: [
      { type: 'charge_virale', unite: 'copies/mL', valeurs: [12000, 180, 0] },
      { type: 'cd4', unite: 'cellules/mm³', valeurs: [310, 450, 620] },
    ],
    vih_vhb: [
      { type: 'charge_virale', unite: 'copies/mL', valeurs: [45000, 900, 0] },
      { type: 'cd4', unite: 'cellules/mm³', valeurs: [240, 390, 540] },
      { type: 'transaminases', unite: 'UI/L', valeurs: [64, 47, 35] },
    ],
    vhb: [
      { type: 'ag_hbs', unite: 'positif', valeurs: [1, 1, 1] },
      { type: 'transaminases', unite: 'UI/L', valeurs: [58, 41, 32] },
    ],
    vhb_vhc: [
      { type: 'ag_hbs', unite: 'positif', valeurs: [1, 1, 1] },
      { type: 'arn_vhc', unite: 'UI/mL', valeurs: [420000, 0, 0] },
    ],
    vhc: [
      { type: 'arn_vhc', unite: 'UI/mL', valeurs: [850000, 1200, 0] },
      { type: 'transaminases', unite: 'UI/L', valeurs: [72, 45, 28] },
    ],
  };
  const joursParDefaut = [-365, -180, -30];
  // Awa (patient de démo) : dernière charge virale il y a 170 jours → rappel « examen bientôt dû »
  const joursPrelevementPour = (index: number) => (index === 0 ? [-365, -250, -170] : joursParDefaut);

  for (const [index, patient] of patients.entries()) {
    const joursPrelevement = joursPrelevementPour(index);
    const affectation = await Affectation.findOne({ where: { patientId: patient.id } });
    const soignantId = affectation?.soignantId ?? soignants[0]!.id;
    const series = observationsParPathologie[patient.pathologie] ?? [];
    for (const s of series) {
      const existing = await Observation.count({ where: { patientId: patient.id, type: s.type } });
      if (existing > 0) continue;
      for (let k = 0; k < joursPrelevement.length; k++) {
        await Observation.create({
          patientId: patient.id, soignantId, type: s.type, valeur: s.valeurs[k]!, unite: s.unite,
          datePrelevement: daysFromNow(joursPrelevement[k]!),
        });
      }
    }
  }

  console.log('✅ Observations');

  // ---------- Signalements ----------
  const signalementsData = [
    { patientIndex: 0, symptome: 'Fatigue persistante', gravite: 'leger' as const, statut: 'nouveau' as const, notes: 'Depuis environ une semaine.' },
    { patientIndex: 2, symptome: 'Nausées après la prise du traitement', gravite: 'modere' as const, statut: 'vu' as const, notes: null },
    { patientIndex: 4, symptome: 'Douleurs abdominales intenses', gravite: 'severe' as const, statut: 'nouveau' as const, notes: 'Apparues brutalement hier soir.' },
  ];

  for (const s of signalementsData) {
    const patient = patients[s.patientIndex];
    if (!patient) continue;
    const existing = await Signalement.findOne({ where: { patientId: patient.id, symptome: s.symptome } });
    if (!existing) {
      await Signalement.create({
        patientId: patient.id, symptome: s.symptome, gravite: s.gravite, statut: s.statut, notes: s.notes,
      });
    }
  }
  console.log('✅ Signalements');

  // ---------- Prises de médicaments (30 derniers jours, hors aujourd'hui) ----------
  // Profils d'observance variés pour la démo (Grâce décroche, les autres sont réguliers)
  const tauxObservance = [0.95, 0.9, 0.86, 0.97, 0.62, 0.8];
  let graine = 42;
  const aleatoire = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  const aujourdhui = jourLocal();

  for (const [index, patient] of patients.entries()) {
    if ((await PriseMedicament.count({ where: { patientId: patient.id } })) > 0) continue;
    const traitements = await Traitement.findAll({ where: { patientId: patient.id, actif: true } });
    const taux = tauxObservance[index] ?? 0.9;
    const lignes = [];
    for (let j = -30; j <= -1; j++) {
      const jour = ajouterJours(aujourdhui, j);
      for (const t of traitements) {
        for (let rang = 1; rang <= prisesParJour(t.frequence); rang++) {
          const r = aleatoire();
          if (r < taux) lignes.push({ patientId: patient.id, traitementId: t.id, datePrevue: jour, rang, statut: 'prise' as const });
          else if (r < taux + (1 - taux) / 2) lignes.push({ patientId: patient.id, traitementId: t.id, datePrevue: jour, rang, statut: 'manquee' as const });
          // sinon : prise non renseignée
        }
      }
    }
    await PriseMedicament.bulkCreate(lignes);
  }
  console.log('✅ Prises de médicaments');


  console.log('\n🎉 Seed terminé.');
  console.log(`   Mot de passe pour tous les comptes seedés : ${SEED_PASSWORD}`);
  console.log('   Soignants :', soignantsData.map((s) => s.email).join(', '));
  console.log('   Patients  :', patientsData.map((p) => p.email).join(', '));

  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ Erreur pendant le seed', err);
  process.exit(1);
});
