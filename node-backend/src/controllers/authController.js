const bcrypt = require('bcryptjs');
const { dbGet, dbRun } = require('../db');
const { BCRYPT_SALT_ROUNDS } = require('../config');
const { signToken } = require('../middleware/auth');
const { validName, normaliseEmail, validPassword } = require('../utils/validators');

// POST /api/signup : create a new account (called when the user clicks "Sign Up")
async function signup(req, res, next) {
  const name = validName(req.body?.name);
  const email = normaliseEmail(req.body?.email);
  const password = validPassword(req.body?.password);

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'A valid name, email, and password (min 8 characters) are required.' });
  }

  try {
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const { lastID } = await dbRun(
      'INSERT INTO users (email, password_hash, name, vector, created_at) VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP)',
      [email, passwordHash, name],
    );

    const token = signToken(lastID);
    res.status(201).json({ userId: lastID, name, email, token, hasProfile: false });
  } catch (error) {
    next(error);
  }
}

// POST /api/login : authenticate an existing account (called when the user clicks "Log In")
async function login(req, res, next) {
  const email = normaliseEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await dbGet('SELECT id, name, email, password_hash, vector FROM users WHERE email = ?', [email]);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id);
    res.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      token,
      hasProfile: Boolean(user.vector),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/me : return the currently logged-in user's basic info (handy for session restore)
async function me(req, res, next) {
  try {
    const user = await dbGet('SELECT id, name, email, vector FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ userId: user.id, name: user.name, email: user.email, hasProfile: Boolean(user.vector) });
  } catch (error) {
    next(error);
  }
}

module.exports = { signup, login, me };
