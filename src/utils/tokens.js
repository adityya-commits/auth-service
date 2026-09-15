// utils/tokens.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const env = require('../config/env');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateRawRefreshToken() {
  // 256 bits of randomness, URL-safe
  return crypto.randomBytes(32).toString('hex');
}

async function issueTokenPair(user, familyId) {
  // 1. Access token — short-lived JWT, signed, carries claims
  const accessToken = jwt.sign(
  { sub: user.id, email: user.email },
  env.accessTokenSecret,
  { expiresIn: env.accessTokenExpiry }
);

  // 2. Refresh token — opaque random string, NOT a JWT
  //    (no need for it to be self-describing; it's just a DB lookup key)
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = sha256(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
//7 days

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, tokenHash, familyId, expiresAt]
  );

  return { accessToken, refreshToken: rawRefreshToken };
}

module.exports = { issueTokenPair, sha256 };