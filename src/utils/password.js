const bcrypt = require('bcrypt');           // ← this was missing
const env = require('../config/env');

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.bcryptRounds);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// Dummy hash used when a user doesn't exist, so bcrypt.compare still runs
// and login timing stays the same whether or not the email exists
const DUMMY_HASH = '$2b$12$invalidsaltinvalidsaltinuS8Kk8ZQnKf9J1oPqYzYqe8XKZ7q6i';

module.exports = { hashPassword, comparePassword, DUMMY_HASH };