/**
 * database-pg.cjs
 * ----------------
 * PostgreSQL adapter that mimics the better-sqlite3 synchronous API used
 * throughout all route files:
 *
 *   db.prepare(sql).get(params)      → returns single row or undefined
 *   db.prepare(sql).all(params)      → returns array of rows
 *   db.prepare(sql).run(params)      → returns { lastInsertRowid, changes }
 *
 * SQLite uses ?  positional placeholders.
 * PostgreSQL uses $1, $2, $3 … positional placeholders.
 *
 * This adapter automatically converts ? → $1, $2, … at prepare() time.
 * All route handlers are already async, so returning a Promise from
 * .get()/.all()/.run() works transparently with await.
 */

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// ─── Connection pool ──────────────────────────────────────────────────────────
// Enable SSL for hosted databases (Supabase, Render Postgres, Railway, etc.)
// Disabled only when connecting to localhost/127.0.0.1
const isLocalDb = process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('localhost') ||
   process.env.DATABASE_URL.includes('127.0.0.1'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err.message);
});

// ─── SQLite → PostgreSQL SQL translation ──────────────────────────────────────

/**
 * Replace ? placeholders with $1, $2, … and fix common SQLite-isms.
 */
function translateSql(sql) {
  let i = 0;
  // Replace every bare ? with $N (skip ?-inside-strings heuristic is good enough
  // because none of our SQL strings contain literal ? characters).
  let translated = sql.replace(/\?/g, () => `$${++i}`);

  // SQLite uses   INTEGER PRIMARY KEY AUTOINCREMENT  →  SERIAL PRIMARY KEY
  translated = translated.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

  // SQLite uses   DATETIME DEFAULT CURRENT_TIMESTAMP  →  TIMESTAMPTZ DEFAULT NOW()
  translated = translated.replace(/DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()');

  // SQLite uses   last_insert_rowid()  →  not needed (we use RETURNING id)
  // SQLite boolean 0/1 → pg accepts TRUE/FALSE but also 0/1 via casting, OK to leave.

  return translated;
}

/**
 * Flatten a single object argument (better-sqlite3 named params style) or
 * an array into a positional array for pg.
 *
 * better-sqlite3 supports:
 *   stmt.get(value1, value2, ...)   – spread positional
 *   stmt.get([value1, value2])      – array positional
 *   stmt.get({ name: value, ... })  – named (used occasionally)
 *
 * We always work with positional arrays for pg.
 */
function toArray(args) {
  if (args.length === 0) return [];
  if (args.length === 1) {
    const v = args[0];
    if (Array.isArray(v)) return v;
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      // Named parameters – return values in order (the SQL must use ? in the
      // same order as Object.values(), which matches how our routes build
      // named-param objects – they always mirror the ? order).
      return Object.values(v);
    }
    return [v];
  }
  return args; // multiple spread positional values
}

// ─── Statement wrapper ────────────────────────────────────────────────────────

class Statement {
  constructor(sql) {
    this._sql = translateSql(sql);
  }

  /**
   * Returns a Promise that resolves to a single row or undefined.
   */
  async get(...args) {
    const params = toArray(args);
    const { rows } = await pool.query(this._sql, params);
    return rows[0] ?? undefined;
  }

  /**
   * Returns a Promise that resolves to an array of rows.
   */
  async all(...args) {
    const params = toArray(args);
    const { rows } = await pool.query(this._sql, params);
    return rows;
  }

  /**
   * Returns a Promise that resolves to { lastInsertRowid, changes }.
   * If the SQL ends with RETURNING id, lastInsertRowid is set from the result.
   */
  async run(...args) {
    const params = toArray(args);
    let sql = this._sql;

    // For INSERT statements that don't already have RETURNING, append it so
    // we can surface lastInsertRowid (mimicking SQLite behaviour).
    const isInsert = /^\s*INSERT/i.test(sql);
    const hasReturning = /RETURNING/i.test(sql);
    if (isInsert && !hasReturning) {
      sql = sql.replace(/;?\s*$/, ' RETURNING id');
    }

    const result = await pool.query(sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id ?? null,
      changes: result.rowCount ?? 0,
    };
  }
}

// ─── db façade (matches better-sqlite3 Database object usage in routes) ───────

const db = {
  /** Mimics better-sqlite3's db.prepare(sql) → Statement */
  prepare(sql) {
    return new Statement(sql);
  },

  /** Mimics db.pragma() – no-op on PostgreSQL (FK enforcement is default) */
  pragma() {},

  /** Run a raw SQL string directly (used by init scripts) */
  async exec(sql) {
    await pool.query(sql);
  },

  /** Expose the pool so init-pg.js can run schema files */
  pool,
};

// ─── Schema initialisation ────────────────────────────────────────────────────

async function initSchema() {
  const repoRoot   = path.resolve(__dirname, '../..');
  const schemaPath = path.resolve(repoRoot, 'database/schema-pg.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('✗ PostgreSQL schema not found at', schemaPath);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(schema);
    console.log('✓ PostgreSQL schema initialised');
  } catch (err) {
    console.error('✗ Schema init error:', err.message);
    process.exit(1);
  }
}

// ─── Connect + init when this module is first required ────────────────────────

let _ready = false;

async function connect() {
  if (_ready) return;
  try {
    await pool.query('SELECT 1');
    console.log('✓ Connected to PostgreSQL');
    await initSchema();
    _ready = true;
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err.message);
    console.error('  Make sure DATABASE_URL is set correctly.');
    process.exit(1);
  }
}

// Export both the db object and the connect() initialiser
module.exports = db;
module.exports.connect = connect;
