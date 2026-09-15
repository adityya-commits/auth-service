const env = require('../config/env');

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,       // true in production (HTTPS)
    sameSite: 'strict',
    path: '/api/auth',              // only sent to auth routes
    maxAge: env.refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
  };
}

function clearRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: '/api/auth',
  };
}

module.exports = { refreshCookieOptions, clearRefreshCookieOptions };