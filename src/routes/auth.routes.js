const express = require('express');
const router = express.Router();

const { signup, login, refresh, logout, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rateLimiter.middleware');
const { validate, signupSchema, loginSchema } = require('../validators/auth.validator');

router.post('/signup', validate(signupSchema), signup);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;