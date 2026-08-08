const { ML_SERVICE_URL } = require('../config');

// --- Helper to call the Python ML service ---

async function callMl(pathname, body) {
  let response;
  try {
    response = await fetch(`${ML_SERVICE_URL}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000), // 60-second timeout — model warm-up / embedding calls can be slow on a cold start
    });
  } catch (error) {
    let message;
    if (error.name === 'TimeoutError') {
      message =
        'The recommendation service took too long to respond (over 60s). It may still be loading its model — check the Python terminal for progress, then try again.';
    } else {
      message = `Could not reach the recommendation service at ${ML_SERVICE_URL}. Make sure the Python ML service (uvicorn main:app) is running.`;
    }
    const unavailable = new Error(message);
    unavailable.status = 503;
    unavailable.cause = error;
    throw unavailable;
  }

  const payload = await response.json().catch(() => ({ detail: 'Invalid response from recommendation service.' }));
  if (!response.ok) {
    const error = new Error(payload.detail || 'Recommendation service request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

module.exports = { callMl };
