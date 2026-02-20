const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// DB path: use DATABASE_PATH env var if set (e.g. on Render with a persistent disk),
// otherwise fall back to a local `./data/apicore.db` relative to the repo root.
const repoRoot = path.resolve(__dirname, '../..');
const defaultDbPath = path.resolve(repoRoot, 'data/apicore.db');
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

// Schema lives alongside the backend in a database/ subfolder
const schemaPath = path.resolve(repoRoot, 'database/schema.sql');

console.log('Repo root:', repoRoot);
console.log('Database path:', dbPath);
console.log('Schema path:', schemaPath);
console.log('Schema exists?', fs.existsSync(schemaPath));

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Read and execute schema
try {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('✓ Database schema initialized successfully');
} catch (error) {
  console.error('Error initializing database schema:', error.message);
}

// Ensure database is ready for clean start
const ensureCleanDatabase = () => {
  try {
    // Database initialized via schema.sql
    // No demo data inserted - use Postman collection instead
    console.log('✓ Database ready for fresh data import');
  } catch (error) {
    console.error('Error setting up database:', error.message);
  }
};

// Run safe migrations for columns added after initial schema
const runMigrations = () => {
  const safeAddColumn = (table, column, type) => {
    try {
      const cols = db.pragma(`table_info(${table})`);
      if (!cols.find(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`  ✓ Added ${table}.${column}`);
      }
    } catch (e) { /* table may not exist yet */ }
  };

  console.log('Running migrations...');
  // Hive star/flag (R6.1)
  safeAddColumn('hives', 'is_starred', 'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'is_flagged', 'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'flag_reason', 'TEXT');
  console.log('✓ Migrations complete');
};

ensureCleanDatabase();
runMigrations();

console.log('✓ Connected to SQLite database at', dbPath);

module.exports = db;
