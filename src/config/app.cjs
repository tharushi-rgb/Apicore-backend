/**
 * app.cjs — Centralized application configuration
 *
 * ALL environment variables and constants are defined HERE.
 * No other file should read process.env directly for app settings.
 * To change a setting, edit THIS file only.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // ─── Server ────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT, 10) || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ─── JWT ───────────────────────────────────────────────────────
  JWT_SECRET: process.env.JWT_SECRET || 'apicore_jwt_secret_key_2024_beekeeping_management',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  JWT_EXPIRE_SECONDS: 7 * 24 * 60 * 60, // 7 days in seconds (used for sign)

  // ─── Database ──────────────────────────────────────────────────
  DATABASE_URL: process.env.DATABASE_URL || null,
  // For local SQLite: DB lives in  New System/database/  (one level above backend)
  DB_DIR: path.resolve(__dirname, '../../../database'),
  get DB_PATH() {
    return process.env.DATABASE_PATH || path.join(this.DB_DIR, 'apicore.db');
  },
  get SCHEMA_PATH() {
    return path.join(this.DB_DIR, 'schema.sql');
  },

  // ─── CORS ──────────────────────────────────────────────────────
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

module.exports = config;
