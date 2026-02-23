/**
 * database.cjs — Universal database adapter
 *
 * When DATABASE_URL is set (Render / Supabase / any PostgreSQL) → uses pg adapter.
 * Otherwise (local development)                                  → uses SQLite via better-sqlite3.
 *
 * All route files import `db` from the shared module and use:
 *   await db.prepare(sql).get(params)
 *   await db.prepare(sql).all(params)
 *   await db.prepare(sql).run(params)
 *
 * Configuration comes from config/app.cjs — no env reads here.
 */

const config = require('./app.cjs');

// ─── PostgreSQL path ──────────────────────────────────────────────────────────
if (config.DATABASE_URL) {
  console.log('✓ DATABASE_URL detected — using PostgreSQL adapter');
  const pgDb = require('./database-pg.cjs');
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

  const dbPath     = config.DB_PATH;
  const schemaPath = config.SCHEMA_PATH;

  console.log('Database path:', dbPath);
  console.log('Schema path:', schemaPath);
  console.log('Schema exists?', fs.existsSync(schemaPath));

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Apply schema
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('✓ Database schema initialised successfully');
  } catch (error) {
    console.error('Error initialising database schema:', error.message);
  }

  // ─── Migrations (columns added after initial schema) ──────────────────────
  const safeAddColumn = (table, column, type) => {
    try {
      const cols = db.pragma(`table_info(${table})`);
      if (!cols.find(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`  ✓ Added ${table}.${column}`);
      }
    } catch (_) { /* column may already exist */ }
  };

  console.log('Running migrations…');
  safeAddColumn('hives', 'is_starred',  'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'is_flagged',  'BOOLEAN DEFAULT 0');
  safeAddColumn('hives', 'flag_reason', 'TEXT');
  // UC1 registration fields
  safeAddColumn('users', 'nic_number',        'TEXT');
  safeAddColumn('users', 'preferred_language', "TEXT DEFAULT 'en'");
  safeAddColumn('users', 'age_group',          'TEXT');
  safeAddColumn('users', 'known_bee_allergy',  "TEXT DEFAULT 'no'");
  safeAddColumn('users', 'blood_group',        'TEXT');
  safeAddColumn('users', 'beekeeping_nature',  'TEXT');
  safeAddColumn('users', 'business_reg_no',    'TEXT');
  safeAddColumn('users', 'primary_bee_species','TEXT');
  safeAddColumn('users', 'nvq_level',          'TEXT');
  console.log('✓ Migrations complete');

  console.log('✓ Connected to SQLite database at', dbPath);

  module.exports = db;
} // end else (SQLite path)
