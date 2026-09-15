const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,                      // connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Catches idle client errors so one bad connection doesn't crash the whole process
  console.error('Unexpected PG pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};