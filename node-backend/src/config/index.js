// --- Central configuration / environment variables ---

require('dotenv').config();

const PORT = Number(process.env.PORT || 5000);
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// Default fallback points at your actual data folder, so you don't need to
// set AURELIUS_DATABASE_PATH every session. Override with the env var if
// this ever moves.
const DEFAULT_DB_PATH = 'C:\\Users\\LENOVO\\Downloads\\database\\database.db';
const DB_PATH = process.env.AURELIUS_DATABASE_PATH || DEFAULT_DB_PATH;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-this-in-production';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using an insecure default — set it before deploying.');
}

// Starter article IDs (used before the user has a profile)
const STARTER_ARTICLE_IDS = [3, 5, 20000, 40000, 60000, 80000, 100000, 120000, 140000, 180000, 240000, 260000, 280000];

module.exports = {
  PORT,
  ML_SERVICE_URL,
  DB_PATH,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  BCRYPT_SALT_ROUNDS,
  STARTER_ARTICLE_IDS,
};
