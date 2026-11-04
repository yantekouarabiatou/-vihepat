/**
 * Données de démonstration de l'agenda : rendez-vous passés (honorés, manqués) et à venir
 * (prévus, confirmés, annulés), sur les seuls patients de démonstration (e-mails @example.com),
 * plus un bilan d'inclusion pour les patients VIH qui n'en ont pas (risque de perte de suivi varié).
 *
 *   npx tsx scripts/seed-agenda.ts             # crée (ou recrée) les données
 *   npx tsx scripts/seed-agenda.ts --nettoyer  # retire seulement ce que ce script a créé
 *
 * Rejouable : les rendez-vous créés portent la note « [demo-agenda] » et sont remplacés à chaque
 * lancement ; un bilan existant n'est jamais modifié. Aucun e-mail n'est envoyé par ce script.
 */
import { Op } from 'sequelize';
import { sequelize } from '../src/config/database';
import { Affectation, BilanInclusion, Patient, RendezVous, User } from '../src/models';
import { evaluerRisquePatient } from '../src/services/perte-de-suivi.service';

const MARQUE = '[demo-agenda]';
const nettoyer = process.argv.includes('--nettoyer');

/** Date à J+n, à l'heure locale donnée */
function jour(n: number, heure: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(heure, minute, 0, 0);
  return d;
}

type Plan = { j: number; h: number; m?: number; motif: string; statut: 'prevu' | 'confirme' | 'effectue' | 'manque' | 'annule' };

/**
 * Scénarios de rendez-vous. Le dernier n'a aucun rendez-vous à venir : attribué à la patiente à
 * risque élevé, il fait apparaître l'alerte de « Patients sans rendez-vous à venir ».
 */
const SCENARIOS: Plan[][] = [
  [
    { j: -84, h: 9, motif: 'Bilan de suivi trimestriel', statut: 'effectue' },
    { j: -2, h: 10, motif: 'Charge virale', statut: 'effectue' },
    { j: 0, h: 15, motif: 'Remise des résultats', statut: 'confirme' },
    { j: 88, h: 9, motif: 'Bilan de suivi trimestriel', statut: 'prevu' },
  ],
  [
    { j: -30, h: 11, motif: 'Échographie hépatique', statut: 'manque' },
    { j: 1, h: 9, m: 30, motif: 'Contrôle des transaminases', statut: 'prevu' },
    { j: 180, h: 9, m: 30, motif: 'Suivi semestriel hépatite B', statut: 'prevu' },
  ],
  [
    { j: -14, h: 14, motif: 'Début de traitement VHC', statut: 'effectue' },
    { j: 1, h: 9, m: 15, motif: 'Contrôle J15', statut: 'confirme' },
    { j: 16, h: 9, motif: 'Contrôle M1', statut: 'prevu' },
    { j: 76, h: 9, motif: 'Contrôle M3', statut: 'prevu' },
  ],
  [
    { j: -60, h: 8, m: 30, motif: 'Renouvellement ARV', statut: 'effectue' },
    { j: -7, h: 8, m: 30, motif: 'Renouvellement ARV', statut: 'manque' },
    { j: 3, h: 8, m: 30, motif: 'Rattrapage du rendez-vous manqué', statut: 'prevu' },
    { j: 5, h: 10, motif: 'Consultation observance', statut: 'annule' },
  ],
  [
    { j: 0, h: 10, m: 30, motif: 'Consultation de suivi', statut: 'prevu' },
    { j: 7, h: 11, motif: 'Entretien avec la médiatrice', statut: 'prevu' },
    { j: 35, h: 11, motif: 'Charge virale', statut: 'prevu' },
  ],
  [{ j: -45, h: 9, motif: 'Bilan annuel', statut: 'effectue' }],
];

/** Profils de bilan d'inclusion (patients VIH), du risque le plus élevé au plus faible */
const BILANS = [
  // Bilan très incomplet (seule l'hémoglobine, basse) : le modèle y voit un risque élevé
  { hemoglobine: 7, situationMatrimoniale: 'celibataire', niveauEtudes: 'aucun', moisDepuis: 2 },
  { stadeOms: 2, cd4: 320, chargeVirale: 12000, hemoglobine: 11.5, alat: 35, creatinine: 80, situationMatrimoniale: 'separe', niveauEtudes: 'primaire', moisDepuis: 10 },
  {
    stadeOms: 1, cd4: 720, chargeVirale: 20, hemoglobine: 13.8, alat: 22, creatinine: 70, plaquettes: 250, proteinesTotales: 72, uree: 4.5, leucocytes: 6.2,
    situationMatrimoniale: 'marie', niveauEtudes: 'superieur', moisDepuis: 48,
  },
] as const;

async function main() {
  await sequelize.authenticate();
  const patients = await Patient.findAll({
    include: [{ model: User, as: 'user', attributes: ['email', 'prenom', 'nom'], where: { email: { [Op.like]: '%@example.com' } } }],
    order: [['codePatient', 'ASC']],
  });
  if (patients.length === 0) throw new Error('Aucun patient de démonstration (@example.com) : lancer d’abord npm run db:seed');
  const ids = patients.map((p) => p.id);

  const retires = await RendezVous.destroy({ where: { patientId: { [Op.in]: ids }, notes: { [Op.like]: `${MARQUE}%` } } });
  console.log(`🧹 ${retires} rendez-vous de démonstration retirés`);
  if (nettoyer) {
    const bilans = await BilanInclusion.destroy({ where: { patientId: { [Op.in]: ids }, dateBilan: { [Op.ne]: null }, soignantId: null } });
    console.log(`🧹 ${bilans} bilans de démonstration retirés`);
    return;
  }

  let crees = 0;
  let iVih = 0;
  for (const [i, p] of patients.entries()) {
    const nom = `${(p as any).user.prenom} ${(p as any).user.nom}`;
    const soignantId = (await Affectation.findOne({ where: { patientId: p.id } }))?.soignantId ?? null;
    // Décalé de 5 : la première patiente VIH (risque élevé) reçoit le scénario sans rendez-vous à venir
    const plans = SCENARIOS[(i + 5) % SCENARIOS.length]!;
    await RendezVous.bulkCreate(
      plans.map((r) => {
        const date = jour(r.j, r.h, r.m);
        const passe = date.getTime() < Date.now();
        return {
          patientId: p.id,
          soignantId,
          dateHeure: date,
          motif: r.motif,
          statut: r.statut,
          notes: `${MARQUE} rendez-vous de démonstration`,
          // Passés : rappel déjà envoyé la veille ; à venir : rappel automatique prévu
          rappelEnvoyeLe: passe && r.statut !== 'annule' ? new Date(date.getTime() - 24 * 3600_000) : null,
          rappelAuto: true,
        };
      })
    );
    crees += plans.length;

    // Bilan d'inclusion pour les patients VIH qui n'en ont pas encore (sans toucher à un bilan existant)
    let risque = '';
    if (p.pathologie.startsWith('vih')) {
      const existant = await BilanInclusion.findOne({ where: { patientId: p.id } });
      let bilan = existant;
      if (!existant) {
        const { moisDepuis, ...valeurs } = BILANS[iVih % BILANS.length]!;
        const dateBilan = new Date();
        dateBilan.setMonth(dateBilan.getMonth() - moisDepuis);
        bilan = await BilanInclusion.create({ patientId: p.id, soignantId: null, dateBilan, ...valeurs } as any);
        iVih++;
      }
      const r = evaluerRisquePatient(p, bilan);
      risque = r.statut === 'calcule' ? ` · risque ${r.niveau} (${Math.round(r.probabilite * 100)} %)${existant ? ', bilan existant' : ''}` : ` · risque : ${r.statut}`;
    }
    console.log(`  ${p.codePatient} ${nom} : ${plans.length} rendez-vous${risque}`);
  }
  console.log(`✅ ${crees} rendez-vous de démonstration créés pour ${patients.length} patients`);
}

main()
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
