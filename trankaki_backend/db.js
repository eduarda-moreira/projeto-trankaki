// Ficheiro: db.js
const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_TQRa1SWw5KlN@ep-soft-dew-aeznnvvq-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'; 

if (connectionString.includes('SUA_CONNECTION_STRING_AQUI')) {
  console.error('ERRO: Por favor, edite o ficheiro "db.js" e insira a sua connection string do Neon.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
});

// Exportamos a capacidade de fazer 'queries'
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};