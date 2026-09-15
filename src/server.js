const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Auth service running on port ${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});