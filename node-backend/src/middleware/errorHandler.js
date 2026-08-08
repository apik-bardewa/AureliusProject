// --- Global error handler ---
// Register this LAST, after all routes, via app.use(errorHandler).

function errorHandler(error, _req, res, _next) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
}

module.exports = errorHandler;
