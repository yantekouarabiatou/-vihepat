/**
 * Vérifie, sur le serveur de production, que l'API peut se connecter à la base et que les tables existent.
 * Lancé depuis cPanel (Setup Node.js App > Run JS script > prod:verifier-base) : n'affiche aucun secret.
 */
require('dotenv').config();
const { sequelize } = require('../dist/config/database');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`BASE OK : connecté à ${process.env.DB_NAME} sur ${process.env.DB_HOST}`);
    const [tables] = await sequelize.query('SHOW TABLES');
    console.log(`${tables.length} table(s) trouvée(s)${tables.length ? '' : ' : importez vihepat_base.sql dans phpMyAdmin'}`);
    if (tables.length) {
      const [[u]] = await sequelize.query('SELECT COUNT(*) AS n FROM users');
      console.log(`${u.n} compte(s) utilisateur`);
    }
    process.exit(0);
  } catch (e) {
    console.error('ERREUR BASE :', e.message);
    process.exit(1);
  }
})();
