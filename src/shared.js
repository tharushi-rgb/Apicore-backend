/**
 * shared.js — Single source of truth for all route dependencies
 *
 * Every route file imports from HERE instead of independently setting up
 * createRequire, database, authenticateToken, config, etc.
 *
 * Usage in any route file:
 *   import { db, authenticateToken, config, sendSuccess, sendError } from '../shared.js';
 */

import jwt from 'jsonwebtoken';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('./config/app.cjs');
const db     = require('./config/database.cjs');

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/**
 * Express middleware — verifies JWT Bearer token and sets req.userId / req.userEmail.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.userId    = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

// ─── Standard Response Helpers ────────────────────────────────────────────────

/** Send a success JSON response */
function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

/** Send an error JSON response and log it */
function sendError(res, message = 'Server error', statusCode = 500, error = null) {
  if (error) console.error(message, error);
  return res.status(statusCode).json({ success: false, message });
}

export { db, config, authenticateToken, sendSuccess, sendError };
