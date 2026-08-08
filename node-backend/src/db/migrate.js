const { dbAll, dbGet, dbRun } = require('./index');
const { DB_PATH } = require('../config');

// Migration: ensure schema supports auth (email/password_hash/name,
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
    console.warn(`Expected database file at: ${DB_PATH}`);
    console.warn('This usually means database.db here is empty/new, and your');
    console.warn('real database (with scraped articles + embeddings) lives');
    console.warn('elsewhere. Set AURELIUS_DATABASE_PATH or update DEFAULT_DB_PATH.');
    console.warn('='.repeat(70));
  }
}

module.exports = { migrateDatabase };
