const { ML_SERVICE_URL } = require('../config');

// GET /api/health : check backend and ML service health
async function health(_req, res) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    res.status(response.ok ? 200 : 503).json({ backend: 'ok', mlService: response.ok ? 'ok' : 'unhealthy' });
  } catch (_error) {
    res.status(503).json({ backend: 'ok', mlService: 'unavailable' });
  }
}

module.exports = { health };
