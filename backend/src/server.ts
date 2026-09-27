import { createApp } from './app';
import { connectDB, sequelize } from './config/database';
import { env } from './config/env';

async function main() {
  await connectDB();

  // ⚠️ En dev uniquement : synchronise les modèles sans migrations
  // En prod, on utilisera sequelize-cli avec des migrations versionnées.
  if (env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: false });
    console.log('✅ Modèles synchronisés');
  }

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