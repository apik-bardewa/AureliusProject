const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');

// --- SQLite database connection ---

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log(`Connected to SQLite database at: ${DB_PATH}`);
});

// --- Promisified db.all / db.get / db.run ---

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

module.exports = { db, dbAll, dbGet, dbRun };
