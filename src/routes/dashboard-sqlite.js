// Dashboard routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data (admin view)
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    // Get user info
    const user = db.prepare('SELECT id, name, email, phone, district, role, years_experience FROM users WHERE id = ?').get(req.userId);
    
    // Get statistics
    const totalApiaries = db.prepare('SELECT COUNT(*) as count FROM apiaries').get().count;
    const activeApiaries = db.prepare('SELECT COUNT(*) as count FROM apiaries WHERE status = ?').get('active').count;
    
    const totalHives = db.prepare('SELECT COUNT(*) as count FROM hives').get().count;
    const activeHives = db.prepare('SELECT COUNT(*) as count FROM hives WHERE status = ?').get('active').count;
    
    const totalHarvests = db.prepare('SELECT COUNT(*) as count FROM harvests').get().count;
    const totalHoneyKg = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM harvests').get().total;
    
    // Get recent alerts
    const alerts = db.prepare(`
      SELECT id, alert_type as type, message, is_read, created_at
      FROM alerts
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    // Get apiaries with hive counts
    const apiaries = db.prepare(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id) as hive_count,
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id AND status = 'active') as active_hive_count
      FROM apiaries a
      ORDER BY a.created_at DESC
    `).all();
    
    // Get hives with apiary info
    const hives = db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      ORDER BY h.created_at DESC
    `).all();

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalApiaries,
          activeApiaries,
          totalHives,
          activeHives,
          totalHarvests,
          totalHoneyKg: parseFloat(totalHoneyKg.toFixed(2))
        },
        alerts,
        apiaries,
        hives
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
