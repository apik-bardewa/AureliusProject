const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Configuration ---

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// Default fallback points at your actual data folder, so you don't need to
// set AURELIUS_DATABASE_PATH every session. Override with the env var if
// this ever moves.
const DEFAULT_DB_PATH = 'C:\\Users\\LENOVO\\Downloads\\database\\database.db';
const dbPath = process.env.AURELIUS_DATABASE_PATH || DEFAULT_DB_PATH;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-this-in-production';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_SALT_ROUNDS = 10;
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using an insecure default — set it before deploying.');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- SQLite database connection and table setup ---

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log(`Connected to SQLite database at: ${dbPath}`);
});

// --- Database helpers: promisified db.all / db.get / db.run ---

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// --- Migration: ensure schema supports auth (email/password_hash/name,
// nullable vector) whether this is a brand-new database or one created
// before signup/login existed. Runs once at startup; safe to run every time.
async function migrateDatabase() {
  // Fresh install: this creates the final desired schema directly.
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      vector TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbRun(`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      article_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(article_id) REFERENCES pages(id)
    )
  `);
  await dbRun('CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id)');

  // Inspect whatever "users" table actually exists (could pre-date auth).
  const columns = await dbAll('PRAGMA table_info(users)');
  const existingNames = new Set(columns.map((column) => column.name));

  const missingColumns = ['email', 'password_hash', 'name'].filter((name) => !existingNames.has(name));
  for (const name of missingColumns) {
    await dbRun(`ALTER TABLE users ADD COLUMN ${name} TEXT`);
    console.log(`Migrated users table: added column "${name}".`);
  }

  // SQLite can't drop a NOT NULL constraint with ALTER TABLE — if the
  // original table was created with "vector TEXT NOT NULL" (pre-auth
  // databases), rebuild the table with a nullable vector column instead.
  const vectorColumn = columns.find((column) => column.name === 'vector');
  if (vectorColumn && vectorColumn.notnull === 1) {
    console.log('Migrating users table: making "vector" nullable (rebuilding table)...');
    await dbRun('ALTER TABLE users RENAME TO users_old');
    await dbRun(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        vector TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      INSERT INTO users (id, email, password_hash, name, vector, created_at)
      SELECT id, email, password_hash, name, vector, created_at FROM users_old
    `);
    await dbRun('DROP TABLE users_old');
    console.log('Migration complete: "vector" is now nullable.');
  }

  // Safe to create only once the email column definitely exists.
  await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  // Sanity check: `pages` isn't created by this file at all — it's expected
  // to already exist in database.db (populated by your data-loading script).
  // Warn loudly once instead of letting every request crash with a raw
  // SQLITE_ERROR stack trace.
  const pagesTable = await dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='pages'");
  if (!pagesTable) {
    console.warn('='.repeat(70));
    console.warn('WARNING: No "pages" table found in database.db.');
    console.warn(`Expected database file at: ${dbPath}`);
    console.warn('This usually means database.db here is empty/new, and your');
    console.warn('real database (with scraped articles + embeddings) lives');
    console.warn('elsewhere. Set AURELIUS_DATABASE_PATH or update DEFAULT_DB_PATH.');
    console.warn('='.repeat(70));
  }
}

migrateDatabase().catch((error) => {
  console.error('Database migration failed:', error.message);
});

// --- Input validation helpers ---

function validIdList(value, maximum = 10000) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, maximum);
}

function validTopicList(value, maximum = 20) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((topic) => String(topic).trim()).filter(Boolean))].slice(0, maximum);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function validName(value) {
  const name = String(value || '').trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

function validPassword(value) {
  const password = String(value || '');
  return password.length >= 8 && password.length <= 200 ? password : null;
}

// --- Auth helpers ---

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

// --- Wikipedia image enrichment ---
// The `pages` table has no image column, so we fetch each article's real
// thumbnail directly from Wikipedia's public REST summary API and attach it
// as `image_url` before sending the article list to the frontend. Results
// are cached in memory for the life of the process (an article's real
// Wikipedia image essentially never changes), so this only pays the network
// cost once per article, ever — not once per request.

const imageCache = new Map(); // article id -> string | null

function extractSummaryUrl(wikiLink) {
  try {
    const url = new URL(wikiLink);
    const title = url.pathname.replace(/^\/wiki\//, '');
    if (!title) return null;
    return `${url.origin}/api/rest_v1/page/summary/${title}`;
  } catch (_error) {
    return null;
  }
}

async function fetchThumbnail(article) {
  if (imageCache.has(article.id)) return imageCache.get(article.id);

  const summaryUrl = extractSummaryUrl(article.wiki_link);
  if (!summaryUrl) {
    imageCache.set(article.id, null);
    return null;
  }

  try {
    const response = await fetch(summaryUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      imageCache.set(article.id, null);
      return null;
    }
    const data = await response.json();
    const url = data?.thumbnail?.source || null;
    imageCache.set(article.id, url);
    return url;
  } catch (_error) {
    imageCache.set(article.id, null);
    return null;
  }
}

// Attaches `image_url` (string or null) to every row in the array, fetching
// in parallel. Never throws — a failed lookup just becomes `image_url: null`
// so the frontend can fall back to its own placeholder.
async function attachImages(rows) {
  const urls = await Promise.all(rows.map((row) => fetchThumbnail(row)));
  return rows.map((row, index) => ({ ...row, image_url: urls[index] }));
}

// --- Starter article IDs (used before the user has a profile) ---

const STARTER_ARTICLE_IDS = [3, 5, 20000, 40000, 60000, 80000, 100000, 120000, 140000, 180000, 240000, 260000, 280000];

// --- Routes ---

// GET /api/onboarding/articles : returns a static set of starter articles for the first load
app.get('/api/onboarding/articles', async (_req, res, next) => {
  try {
    const placeholders = STARTER_ARTICLE_IDS.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT id, title, first_two_sentences, category, wiki_link
       FROM pages WHERE id IN (${placeholders})`,
      STARTER_ARTICLE_IDS,
    );
    // Preserve the original order
    const order = new Map(STARTER_ARTICLE_IDS.map((id, index) => [id, index]));
    rows.sort((a, b) => order.get(a.id) - order.get(b.id));
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:userId : check if user exists
app.get('/api/users/:userId', async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid userId is required.' });
  }

  try {
    const rows = await dbAll('SELECT id FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User profile was not found.' });
    }
    res.json({ exists: true, userId });
  } catch (error) {
    next(error);
  }
});

// POST /api/signup : create a new account (called when the user clicks "Sign Up")
app.post('/api/signup', async (req, res, next) => {
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
});

// POST /api/login : authenticate an existing account (called when the user clicks "Log In")
app.post('/api/login', async (req, res, next) => {
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
});

// GET /api/me : return the currently logged-in user's basic info (handy for session restore)
app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    const user = await dbGet('SELECT id, name, email, vector FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ userId: user.id, name: user.name, email: user.email, hasProfile: Boolean(user.vector) });
  } catch (error) {
    next(error);
  }
});

// POST /api/onboard : create/attach a recommendation profile via the ML service.
// If the request carries a valid Authorization token, the profile is linked to
// that logged-in account. Otherwise it falls back to the old anonymous flow.
app.post('/api/onboard', attachUserIfPresent, async (req, res, next) => {
  const articleIds = validIdList(req.body?.articleIds, 20);
  const topics = validTopicList(req.body?.topics, 20);
  if (articleIds.length === 0 && topics.length === 0) {
    return res.status(400).json({ error: 'Select at least one article or topic to start your feed.' });
  }

  try {
    const mlPayload = { article_ids: articleIds, topics };
    if (req.userId) {
      mlPayload.user_id = req.userId;
    }
    const profile = await callMl('/onboard', mlPayload);
    res.status(201).json({ userId: profile.user_id ?? profile.userId });
  } catch (error) {
    next(error);
  }
});

// POST /api/feed : get personalized article recommendations
app.post('/api/feed', async (req, res, next) => {
  const userId = Number(req.body?.userId);
  const seenIds = validIdList(req.body?.seenIds);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'A valid userId is required. Complete onboarding first.' });
  }

  try {
    // Ask ML service for recommendations (article IDs)
    const recommendation = await callMl('/recommend', {
      user_id: userId,
      seen_ids: seenIds,
      limit: 20,
    });
    const articleIds = validIdList(recommendation.article_ids, 20);
    if (articleIds.length === 0) return res.json([]);

    // Fetch full article data from SQLite
    const placeholders = articleIds.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT id, title, first_two_sentences, category, wiki_link
       FROM pages WHERE id IN (${placeholders})`,
      articleIds,
    );
    // Reorder to match the sequence from ML
    const order = new Map(articleIds.map((id, index) => [id, index]));
    rows.sort((a, b) => order.get(a.id) - order.get(b.id));
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// POST /api/interact : log an interaction and update user vector
app.post('/api/interact', async (req, res, next) => {
  const userId = Number(req.body?.userId);
  const articleId = Number(req.body?.articleId);
  const action = String(req.body?.action || '').toLowerCase();
  const allowedActions = new Set(['upvote', 'downvote', 'save', 'share']);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(articleId) || articleId <= 0 || !allowedActions.has(action)) {
    return res.status(400).json({ error: 'userId, articleId, and a valid action are required.' });
  }

  try {
    await callMl('/interact', { user_id: userId, article_id: articleId, action });
    res.status(204).end(); // No content
  } catch (error) {
    next(error);
  }
});

// POST /api/explain : "Why am I seeing this article?" — returns a human-readable
// explanation of why the given article was recommended to this user.
// This is the endpoint the frontend button should call.
app.post('/api/explain', async (req, res, next) => {
  const userId = Number(req.body?.userId);
  const articleId = Number(req.body?.articleId);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(articleId) || articleId <= 0) {
    return res.status(400).json({ error: 'A valid userId and articleId are required.' });
  }

  try {
    const explanation = await callMl('/explain', { user_id: userId, article_id: articleId });
    res.json(explanation);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookmarks : list the logged-in user's saved (bookmarked) articles,
// most recently saved first. Requires an Authorization: Bearer <token> header.
// An article only appears here if its MOST RECENT save/unsave action for this
// user is 'save' — so removing then re-saving the same article works correctly.
app.get('/api/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const rows = await dbAll(
      `SELECT p.id, p.title, p.first_two_sentences, p.category, p.wiki_link, latest.saved_at
       FROM (
         SELECT article_id, action, timestamp AS saved_at,
                ROW_NUMBER() OVER (
                  PARTITION BY article_id
                  ORDER BY timestamp DESC, id DESC
                ) AS rn
         FROM interactions
         WHERE user_id = ? AND action IN ('save', 'unsave')
       ) latest
       JOIN pages p ON p.id = latest.article_id
       WHERE latest.rn = 1 AND latest.action = 'save'
       ORDER BY latest.saved_at DESC`,
      [req.userId],
    );
    const enriched = await attachImages(rows);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bookmarks/:articleId : remove an article from saved/bookmarks.
// Logs an 'unsave' interaction rather than deleting history — this is a
// Node-only, append-only log entry; it intentionally does NOT call the ML
// service, since removing a bookmark shouldn't reverse the profile-vector
// nudge a "save" gave it (that's a deliberate simplification, not a bug —
// see the "known limitations" doc if this ever needs revisiting).
app.delete('/api/bookmarks/:articleId', requireAuth, async (req, res, next) => {
  const articleId = Number(req.params.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    return res.status(400).json({ error: 'A valid articleId is required.' });
  }

  try {
    await dbRun(
      'INSERT INTO interactions (user_id, article_id, action, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [req.userId, articleId, 'unsave'],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// GET /api/health : check backend and ML service health
app.get('/api/health', async (_req, res) => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    res.status(response.ok ? 200 : 503).json({ backend: 'ok', mlService: response.ok ? 'ok' : 'unhealthy' });
  } catch (_error) {
    res.status(503).json({ backend: 'ok', mlService: 'unavailable' });
  }
});

// --- Global error handler ---

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
});

// --- Start server ---

app.listen(PORT, () => console.log(`Aurelius backend running on port ${PORT}`));