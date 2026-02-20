/**
 * database.cjs  –  Universal database adapter
 *
 * When DATABASE_URL is set (Render / any PostgreSQL host) → uses pg adapter.
 * Otherwise (local development)                           → uses SQLite via better-sqlite3.
 *
 * All 18 route files require this file and use the same interface:
 *   db.prepare(sql).get(params)
 *   db.prepare(sql).all(params)
 *   db.prepare(sql).run(params)
 */

// ─── PostgreSQL path ──────────────────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  console.log('✓ DATABASE_URL detected – using PostgreSQL adapter');
  const pgDb = require('./database-pg.cjs');
  // Kick off async connection + schema init; routes will await the Promises
  // returned by .get()/.all()/.run() so the pool being "warming up" is fine.
  pgDb.connect().catch((err) => {
    console.error('Fatal: could not connect to PostgreSQL:', err.message);
    process.exit(1);
  });
  module.exports = pgDb;
} else {

// ─── SQLite path (local dev) ──────────────────────────────────────────────────
const Database = require('better-sqlite3');
const fs   = require('fs');
const path = require('path');

const repoRoot      = path.resolve(__dirname, '../..');
const defaultDbPath = path.resolve(repoRoot, 'data/apicore.db');
const dbPath        = process.env.DATABASE_PATH || defaultDbPath;
const schemaPath    = path.resolve(repoRoot, 'database/schema.sql');

console.log('Repo root:', repoRoot);
console.log('Database path:', dbPath);
console.log('Schema path:', schemaPath);
console.log('Schema exists?', fs.existsSync(schemaPath));

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

try {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('✓ Database schema initialized successfully');
} catch (error) {
  console.error('Error initializing database schema:', error.message);
}

console.log('✓ Database ready for fresh data import');

// Safe migrations for columns added after initial schema
const runMigrations = () => {
  const safeAddColumn = (table, column, type) => {
    try {
      const cols = db.pragma(`table_info(${table})`);
      if (!cols.find(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`  ✓ Added ${table}.${column}`);
      }
    } catch (e) { /* ignore */ }
  };
  console.log('Running migrations...');
  safeAddColumn('hives', 'is_starred', 'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'is_flagged', 'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'flag_reason', 'TEXT');
  console.log('✓ Migrations complete');
};
runMigrations();

console.log('✓ Connected to SQLite database at', dbPath);

module.exports = db;

} // end else (SQLite path)
