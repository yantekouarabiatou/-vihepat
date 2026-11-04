import { createApp } from './app';
import { connectDB } from './config/database';
import { env } from './config/env';
import { verifySmtpConnection } from './services/mail.service';
import { chargerPermissions } from './services/permissions.service';
import { mettreAJourSchema } from './services/schema.service';
import { verifierModelePerteSuivi } from './ia/perte-de-suivi';
import { demarrerPlanificateur } from './services/rappels-serveur.service';
import { demarrerRappelsRdv } from './services/rappel-rdv.service';

async function main() {
  await connectDB();
  await mettreAJourSchema();
  await chargerPermissions();
  verifierModelePerteSuivi();
  void verifySmtpConnection();
  // Rappels envoyés par le serveur (application fermée)
  demarrerPlanificateur();
  // Rappel automatique des rendez-vous, la veille
  demarrerRappelsRdv();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🚀 API VIHEPAT → http://localhost:${env.PORT}`);
    console.log(`   Health : http://localhost:${env.PORT}/health`);
  });
}

main().catch((err) => {
  console.error('❌ Erreur de démarrage', err);
  process.exit(1);
});
