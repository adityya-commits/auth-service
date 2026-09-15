const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const loginLimiter = rateLimit({
  windowMs: env.loginRateLimit.windowMin * 60 * 1000,
  max: env.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

module.exports = { loginLimiter };