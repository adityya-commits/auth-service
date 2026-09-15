const crypto = require('crypto');
const db = require('../db');
const { hashPassword, comparePassword, DUMMY_HASH } = require('../utils/password');
const { issueTokenPair, sha256 } = require('../utils/tokens');
const { refreshCookieOptions, clearRefreshCookieOptions } = require('../utils/cookies');

async function signup(req, res, next) {
  try {
    const { email, password } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      // Same generic message either way — don't confirm/deny account existence
      return res.status(409).json({ error: 'Unable to create account' });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Unable to create account' });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Always compare against something — keeps timing consistent whether
    // or not the user exists, so attackers can't enumerate valid emails
    const hashToCheck = user ? user.password_hash : DUMMY_HASH;
    const passwordMatches = await comparePassword(password, hashToCheck);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const familyId = crypto.randomUUID();
    const { accessToken, refreshToken } = await issueTokenPair(user, familyId);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions());
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const oldToken = req.cookies.refreshToken;
    if (!oldToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const tokenHash = sha256(oldToken);
    const result = await db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    const record = result.rows[0];

    if (!record) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (record.revoked) {
      // Reuse of an already-rotated-out token — treat as compromise
      await db.query(
        'UPDATE refresh_tokens SET revoked = true WHERE family_id = $1',
        [record.family_id]
      );
      res.clearCookie('refreshToken', clearRefreshCookieOptions());
      return res.status(401).json({ error: 'Token reuse detected — please log in again' });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [record.user_id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Rotate: mark old as revoked, issue new token in same family
    await db.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);
    const { accessToken, refreshToken } = await issueTokenPair(user, record.family_id);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions());
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const tokenHash = sha256(token);
      await db.query(
        'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
        [tokenHash]
      );
    }
    res.clearCookie('refreshToken', clearRefreshCookieOptions());
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    // req.user set by requireAuth middleware
    res.json({ id: req.user.id, email: req.user.email });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, me };