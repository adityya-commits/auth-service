function errorHandler(err, req, res, next) {
  console.error(err);

  // Never leak stack traces or raw DB errors to the client
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };