const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const env = require('./config/env');
const { requireAuth } = require('./middleware/auth.middleware');
const { me } = require('./controllers/auth.controller');
const app = express();

app.set('trust proxy', 1); // needed for correct req.ip behind a proxy/load balancer

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.get('/api/me', requireAuth, me);

app.get('/health', (req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — must be last
app.use(errorHandler);

module.exports = app;