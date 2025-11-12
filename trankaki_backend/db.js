// Ficheiro: db.js
require('dotenv').config();
const { Pool } = require('pg');


const connectionString = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_TQRa1SWw5KlN@ep-soft-dew-aeznnvvq-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Cria o pool com SSL habilitado (necessário no NeonDB)
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
