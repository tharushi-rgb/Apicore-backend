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
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get user info
    const user = await db.prepare('SELECT id, name, email, phone, district, role, years_experience FROM users WHERE id = ?').get(req.userId);
    
    // Get statistics
    const totalApiariesRow = await db.prepare('SELECT COUNT(*) as count FROM apiaries').get();
    const totalApiaries = totalApiariesRow ? totalApiariesRow.count : 0;
    const activeApiariesRow = await db.prepare('SELECT COUNT(*) as count FROM apiaries WHERE status = ?').get('active');
    const activeApiaries = activeApiariesRow ? activeApiariesRow.count : 0;
    
    const totalHivesRow = await db.prepare('SELECT COUNT(*) as count FROM hives').get();
    const totalHives = totalHivesRow ? totalHivesRow.count : 0;
    const activeHivesRow = await db.prepare('SELECT COUNT(*) as count FROM hives WHERE status = ?').get('active');
    const activeHives = activeHivesRow ? activeHivesRow.count : 0;
    
    const totalHarvestsRow = await db.prepare('SELECT COUNT(*) as count FROM harvests').get();
    const totalHarvests = totalHarvestsRow ? totalHarvestsRow.count : 0;
    const totalHoneyRow = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM harvests').get();
    const totalHoneyKg = totalHoneyRow ? Number(totalHoneyRow.total) : 0;
    
    // Get recent alerts
    const alerts = await db.prepare(`
      SELECT id, alert_type as type, message, is_read, created_at
      FROM alerts
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    // Get apiaries with hive counts
    const apiaries = await db.prepare(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id) as hive_count,
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id AND status = 'active') as active_hive_count
      FROM apiaries a
      ORDER BY a.created_at DESC
    `).all();
    
    // Get hives with apiary info
    const hives = await db.prepare(`
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
