const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Requires a valid Bearer token; rejects the request if missing/invalid.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required. Include an Authorization: Bearer <token> header.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = Number(decoded.sub);
    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Attaches req.userId if a valid token is present, but never blocks the request.
function attachUserIfPresent(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = Number(decoded.sub);
    } catch (_error) {
      // Ignore invalid tokens on optional-auth routes
    }
  }
  next();
}

module.exports = { signToken, requireAuth, attachUserIfPresent };
