require('dotenv').config();

const required = [
  'DATABASE_URL',
  'ACCESS_TOKEN_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    // Fail fast at boot — never let the server start with missing secrets
    console.error(`FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  loginRateLimit: {
    windowMin: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN, 10) || 15,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5,
  },
};