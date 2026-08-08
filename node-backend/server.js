const express = require('express');
const cors = require('cors');

const apiRoutes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const { migrateDatabase } = require('./src/db/migrate');
const { PORT } = require('./src/config');

const app = express();

// --- Global middleware ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- API routes ---
app.use('/api', apiRoutes);

// --- Global error handler (must be registered last) ---
app.use(errorHandler);

// --- Run migration, then start server ---
migrateDatabase().catch((error) => {
  console.error('Database migration failed:', error.message);
});

app.listen(PORT, () => console.log(`Aurelius backend running on port ${PORT}`));