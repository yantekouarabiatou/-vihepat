require('dotenv/config');

// Config lue par sequelize-cli (CommonJS, pas de ts-node) — mêmes variables
// d'environnement que src/config/env.ts (lu, lui, par l'application).
const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dialect: 'mysql',
  timezone: '+01:00',
  define: { underscored: true, timestamps: true },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
