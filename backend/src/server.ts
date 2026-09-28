import { createApp } from './app';
import { connectDB } from './config/database';
import { env } from './config/env';
import { verifySmtpConnection } from './services/mail.service';

async function main() {
  await connectDB();
  void verifySmtpConnection();

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
